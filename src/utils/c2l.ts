import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  C2L_COPY,
  C2L_DEFAULT_URL,
  type C2LStepNumber,
} from "@/utils/c2l-options";

/**
 * Staff's "what's missing" note for a step, shown to the student when their
 * C2L report came back incomplete. Returns "" when there's nothing to say (or
 * before migration 0008 adds the column).
 */
export async function getStepStaffNote(
  applicationId: string,
  stepNumber: number,
): Promise<string> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("step_progress")
    .select("staff_note")
    .eq("application_id", applicationId)
    .eq("step_number", stepNumber)
    .maybeSingle();
  if (error) return "";
  return typeof data?.staff_note === "string" ? data.staff_note : "";
}

/**
 * The outbound C2LPHL link for a C2L step. Admin-editable in cycle_settings
 * (c2l_application_url / c2l_documents_url) so it can change without a deploy,
 * but it falls back to C2LPHL's public site so the button is always there.
 */
export async function getC2LUrl(
  cycleId: string,
  stepNumber: C2LStepNumber,
): Promise<string> {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("cycle_settings")
    .select("value")
    .eq("cycle_id", cycleId)
    .eq("key", C2L_COPY[stepNumber].urlKey)
    .maybeSingle();
  return typeof data?.value === "string" && data.value.trim()
    ? data.value.trim()
    : C2L_DEFAULT_URL;
}
