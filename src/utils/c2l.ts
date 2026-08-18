import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

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
 * The admin-editable outbound URL for a C2L step, or "" when it hasn't been
 * set yet. Cycle-specific copy lives in the database, never in code, so the
 * step pages render their link only once staff fill this in.
 */
export async function getC2LUrl(cycleId: string, key: string): Promise<string> {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("cycle_settings")
    .select("value")
    .eq("cycle_id", cycleId)
    .eq("key", key)
    .maybeSingle();
  return typeof data?.value === "string" ? data.value : "";
}
