"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getPortalData, setStepStatus } from "@/utils/step-engine";
import { field, type FieldErrors } from "@/utils/validation";
import { syncEssayPrompts } from "@/utils/essay-prompts";
import {
  countWords,
  responseField,
  STEP3_MAX_WORDS,
  STEP3_MIN_WORDS,
  type Step3State,
} from "@/utils/step3-options";

const SAVE_FAILED = "We couldn't save your answers. Please try again.";
const NO_PROMPTS =
  "There aren't any questions to answer yet. Check back soon — nothing is wrong with your application.";

/**
 * Saves Step 3's short answers. "Save progress" stores whatever is written so
 * far; "Submit" additionally requires every active prompt to be answered.
 *
 * Answers are ALWAYS persisted before validation is reported, and the answers
 * are echoed back in the returned state — React 19 resets uncontrolled fields
 * once a form action returns, so anything not handed back vanishes from the
 * screen, and anything not written to the database is gone for good.
 */
export async function saveStep3(
  _prev: Step3State,
  formData: FormData,
): Promise<Step3State> {
  const intent = field(formData, "intent") === "submit" ? "submit" : "save";

  const portal = await getPortalData();
  if (!portal) redirect("/login");

  const supabase = createClient(await cookies());
  const wasComplete =
    portal.steps.find((s) => s.number === 3)?.status === "complete";

  // The prompt list comes from the database (kept in step with the hard-coded
  // questions), never from the submitted form, so a client can't invent, skip,
  // or reorder questions.
  await syncEssayPrompts(portal.cycleId);
  const { data: prompts, error: promptErr } = await supabase
    .from("essay_prompts")
    .select("id")
    .eq("cycle_id", portal.cycleId)
    .eq("is_active", true)
    .order("sort_order");
  if (promptErr) return { errors: { form: SAVE_FAILED } };
  if (!prompts?.length) return { errors: { form: NO_PROMPTS } };

  const values: Record<string, string> = {};
  for (const p of prompts) {
    values[p.id as string] = field(formData, responseField(p.id as string));
  }

  // Every answer must fit the word window. The ceiling is checked on a plain
  // save too (nobody should park a 600-word answer they'll have to cut later);
  // the floor only matters once they submit, since a draft is naturally short.
  const errors: FieldErrors = {};
  for (const p of prompts) {
    const key = responseField(p.id as string);
    const text = values[p.id as string];
    const words = countWords(text);
    if (words > STEP3_MAX_WORDS) {
      errors[key] = `Please keep this to ${STEP3_MAX_WORDS} words or fewer — you're at ${words}.`;
    } else if (intent === "submit") {
      if (!text) {
        errors[key] = "Please answer this question.";
      } else if (words < STEP3_MIN_WORDS) {
        errors[key] = `Please write at least ${STEP3_MIN_WORDS} words — you're at ${words}.`;
      }
    }
  }
  const hasErrors = Object.keys(errors).length > 0;

  // Persist first: a failed submit must never cost a student their writing.
  const { error: saveErr } = await supabase.from("essay_responses").upsert(
    prompts.map((p) => ({
      application_id: portal.applicationId,
      prompt_id: p.id as string,
      response: values[p.id as string],
    })),
    { onConflict: "application_id,prompt_id" },
  );
  if (saveErr) return { errors: { form: SAVE_FAILED }, values };

  if (hasErrors) {
    if (!wasComplete) await setStepStatus(3, "in_progress");
    revalidatePath("/portal", "layout");
    return { errors, values };
  }

  if (intent === "submit") {
    const { error } = await setStepStatus(3, "complete");
    if (error) return { errors: { form: error }, values };
  } else if (!wasComplete) {
    // Saving moves a not-started step forward but never downgrades one that is
    // already complete.
    const { error } = await setStepStatus(3, "in_progress");
    if (error) return { errors: { form: error }, values };
  }

  revalidatePath("/portal", "layout");

  return {
    success:
      intent === "submit"
        ? wasComplete
          ? "Your answers have been updated."
          : "Step 3 is complete!"
        : "Your progress has been saved.",
    justCompleted: intent === "submit" && !wasComplete,
    values,
  };
}
