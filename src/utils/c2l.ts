import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

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
