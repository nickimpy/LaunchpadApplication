// Reads the Turnstile token posted by <Turnstile /> (components/turnstile.tsx).
// Undefined when there isn't one — which is normal while the bot check is
// switched off — so Supabase calls simply omit it.
export function captchaToken(formData: FormData): string | undefined {
  const value = formData.get("captcha_token");
  return typeof value === "string" && value ? value : undefined;
}
