"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

/**
 * "Not you? Log out" on the login/signup pages: signs the current person out
 * and puts the NEXT person right back on the page they were trying to use, so
 * a second student on a shared computer can create their own account.
 */
export async function signOutAndReturn(formData: FormData): Promise<void> {
  const raw = String(formData.get("next") ?? "");
  // Same-site paths only (this comes from the browser).
  const next =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/login";
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect(next);
}
