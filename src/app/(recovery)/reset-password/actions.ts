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
  if (error) {
    // Say what actually went wrong where we can: "try again" is no help to
    // someone whose new password was rejected for a reason they can fix.
    if (error.code === "same_password") {
      return {
        error:
          "That's the same as your current password. Choose a different one.",
      };
    }
    if (error.code === "weak_password") {
      return {
        error:
          "That password is too easy to guess. Try a longer one, or mix in numbers and symbols.",
      };
    }
    return { error: "We couldn't update your password. Please try again." };
  }

  redirect("/portal");
}
