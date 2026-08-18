import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getPortalData } from "@/utils/step-engine";

export type ReleasedDecision = {
  status: string;
  releasedAt: string;
};

/**
 * The student's own decision, but only once staff have released it.
 *
 * The RLS policy `decisions_student_released` already restricts SELECT to rows
 * with `released_at is not null`, so an unreleased decision is invisible at the
 * database level — this read cannot leak one even if the UI is wrong. The
 * `released_at` filter here is belt-and-braces, not the actual guard.
 */
export async function getMyReleasedDecision(): Promise<ReleasedDecision | null> {
  const portal = await getPortalData();
  if (!portal) return null;

  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("decisions")
    .select("status, released_at")
    .eq("application_id", portal.applicationId)
    .not("released_at", "is", null)
    .maybeSingle();

  if (!data?.released_at) return null;
  return { status: data.status as string, releasedAt: data.released_at as string };
}
