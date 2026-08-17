import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";

/**
 * The student's own parent form link, for the Step 2 page. Returns null until
 * Step 1 has been submitted (the token exists from signup, but sharing it
 * before Step 1 is done would send a parent to a half-empty form).
 *
 * Step 1's loader builds the same URL from data it already has — this is the
 * cheap standalone lookup for pages that don't need the rest of Step 1.
 */
export async function getParentLinkUrl(
  applicationId: string,
): Promise<string | null> {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("applications")
    .select("parent_link_token, parent_link_generated_at")
    .eq("id", applicationId)
    .maybeSingle();

  if (!data?.parent_link_token || !data.parent_link_generated_at) return null;
  return `${await getOrigin()}/parent/${data.parent_link_token}`;
}
