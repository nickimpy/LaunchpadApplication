import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getPortalData } from "@/utils/step-engine";
import type { StepStatus } from "@/utils/steps";

export type Step3Prompt = {
  id: string;
  prompt: string;
  response: string;
};

export type Step3Data = {
  status: StepStatus;
  complete: boolean;
  contactEmail: string;
  prompts: Step3Prompt[];
};

/**
 * Step 3's active prompts for the student's cycle, each with whatever they've
 * written so far. Prompt text is data (`essay_prompts`), never code, so the
 * full scaffolded question set can replace the beta placeholder without a
 * deploy. Returns null when logged out.
 */
export async function getStep3Data(): Promise<Step3Data | null> {
  const portal = await getPortalData();
  if (!portal) return null;

  const supabase = createClient(await cookies());
  const status = portal.steps.find((s) => s.number === 3)?.status ?? "not_started";

  const [{ data: prompts }, { data: responses }] = await Promise.all([
    supabase
      .from("essay_prompts")
      .select("id, prompt")
      .eq("cycle_id", portal.cycleId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("essay_responses")
      .select("prompt_id, response")
      .eq("application_id", portal.applicationId),
  ]);

  const answers = new Map(
    responses?.map((r) => [r.prompt_id as string, r.response as string]) ?? [],
  );

  return {
    status,
    complete: status === "complete",
    contactEmail: portal.contactEmail,
    prompts: (prompts ?? []).map((p) => ({
      id: p.id as string,
      prompt: p.prompt as string,
      response: answers.get(p.id as string) ?? "",
    })),
  };
}
