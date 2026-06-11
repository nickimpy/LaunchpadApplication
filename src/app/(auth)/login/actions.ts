"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { emailError, field, passwordError } from "@/utils/validation";

export type LoginState = {
  error?: string;
  values?: Record<string, string>;
};

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = field(formData, "email").toLowerCase();
  const password = (formData.get("password") ?? "").toString();

  if (emailError(email) || passwordError(password))
    return { error: "Enter your email and password.", values: { email } };

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed")
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    return {
      error: "That email or password doesn't match. Please try again.",
      values: { email },
    };
  }

  redirect("/profile");
}

export type MagicLinkState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = field(formData, "email").toLowerCase();
  const invalid = emailError(email);
  if (invalid) return { error: invalid, values: { email } };

  const supabase = createClient(await cookies());
  // shouldCreateUser:false — magic link signs in existing students only;
  // new accounts go through /signup so we collect name, DOB, phone, prefs.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error)
    return {
      error: "We couldn't send the link. Please try again in a minute.",
      values: { email },
    };
  return {
    success: `If an account exists for ${email}, a magic sign-in link is on its way. Check your inbox.`,
  };
}
