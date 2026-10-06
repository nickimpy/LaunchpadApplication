"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isActiveAdmin } from "@/utils/admin";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";
import { authErrorMessage, emailSendErrorMessage } from "@/utils/auth-errors";
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed")
      redirect(`/verify-email?email=${encodeURIComponent(email)}`);
    return {
      // Rate limits, outages, a disabled account etc. each get their own
      // message — telling someone their password is wrong when it isn't sends
      // them off to reset a password that was fine.
      error: authErrorMessage(
        error,
        "We couldn't log you in just now. Please try again in a moment.",
      ),
      values: { email },
    };
  }

  redirect((await isActiveAdmin(data.user.id)) ? "/admin" : "/portal");
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
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await getOrigin()}/auth/callback`,
    },
  });

  if (error)
    return {
      error: emailSendErrorMessage(
        error,
        "We couldn't send the link. Please try again in a minute.",
      ),
      values: { email },
    };
  return {
    success: `If an account exists for ${email}, a magic sign-in link is on its way. Check your inbox.`,
  };
}
