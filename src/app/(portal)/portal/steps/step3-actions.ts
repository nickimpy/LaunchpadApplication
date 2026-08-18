"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getPortalData, setStepStatus } from "@/utils/step-engine";
import { field, type FieldErrors } from "@/utils/validation";
import { responseField, type Step3State } from "@/utils/step3-options";

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

  // The prompt list comes from the database, never from the submitted form, so
  // a client can't invent, skip, or reorder questions.
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

  const errors: FieldErrors = {};
  if (intent === "submit") {
    for (const p of prompts) {
      if (!values[p.id as string]) {
        errors[responseField(p.id as string)] = "Please answer this question.";
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
