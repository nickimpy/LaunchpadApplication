"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";

export type InlineState = { error?: string; saved?: boolean };

/**
 * Inline edit of a student's interview track straight from the applicant
 * table, so staff can re-route a batch of students without opening each
 * profile. Track is normally derived from the partner-school list; setting it
 * here marks it as a deliberate override (`track_overridden`) so the Phase 8
 * auto-assignment never silently undoes a staff decision.
 */
export async function setTrack(
  applicationId: string,
  _prev: InlineState,
  formData: FormData,
): Promise<InlineState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "No permission." };

  const raw = (formData.get("track") ?? "").toString();
  const track = raw === "A" || raw === "B" ? raw : null;

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("applications")
    .select("track")
    .eq("id", applicationId)
    .maybeSingle();

  const { error } = await supabase
    .from("applications")
    .update({ track, track_overridden: track !== null })
    .eq("id", applicationId);
  if (error) return { error: "Didn't save." };

  await logAdminAction({
    actor: admin,
    action: "application.track_update",
    entityType: "application",
    entityId: applicationId,
    before,
    after: { track },
  });

  revalidatePath("/admin/applicants");
  return { saved: true };
}
