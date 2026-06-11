"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { emailError, field } from "@/utils/validation";

export type ResendState = { error?: string; success?: string };

export async function resendVerification(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const email = field(formData, "email").toLowerCase();
  const invalid = emailError(email);
  if (invalid) return { error: invalid };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error)
    return {
      error: "We couldn't resend the email. Please try again in a minute.",
    };
  return { success: "Sent! Check your inbox for a fresh verification link." };
}
