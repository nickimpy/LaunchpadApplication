"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";
import { emailSendErrorMessage } from "@/utils/auth-errors";
import { emailError, field } from "@/utils/validation";

export type ResetRequestState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};

// Shared by the forgot-password page and the duplicate-email prompt on
// signup. The reset email's link comes from the "Reset Password" template
// (type=recovery), which lands on /auth/confirm → /reset-password.
export async function sendPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = field(formData, "email").toLowerCase();
  const invalid = emailError(email);
  if (invalid) return { error: invalid, values: { email } };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error)
    return {
      error: emailSendErrorMessage(
        error,
        "We couldn't send the reset email. Please try again in a minute.",
      ),
      values: { email },
    };
  return {
    success: `If an account exists for ${email}, a password reset link is on its way. Check your inbox.`,
  };
}
