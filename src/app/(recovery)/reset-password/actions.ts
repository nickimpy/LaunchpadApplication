"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { passwordError } from "@/utils/validation";

export type ResetPasswordState = { error?: string };

export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = (formData.get("password") ?? "").toString();
  const confirm = (formData.get("confirm_password") ?? "").toString();

  const invalid = passwordError(password);
  if (invalid) return { error: invalid };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = createClient(await cookies());
  // The recovery link (via /auth/confirm) put a session in place; updateUser
  // applies to that signed-in user.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      error:
        "Your reset link has expired. Request a new one from the login page.",
    };

  const { error } = await supabase.auth.updateUser({ password });
  if (error)
    return { error: "We couldn't update your password. Please try again." };

  redirect("/portal");
}
