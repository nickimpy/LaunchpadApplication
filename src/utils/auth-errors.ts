import "server-only";
import type { AuthError } from "@supabase/supabase-js";

// Supabase's built-in email service (pre-Phase 9, no custom SMTP) allows only
// a few emails per hour project-wide. Surface that instead of a generic error.
export function emailSendErrorMessage(
  error: AuthError,
  fallback: string,
): string {
  if (error.code === "over_email_send_rate_limit")
    return (
      "We've sent too many emails in the last hour (our test email service " +
      "has a low limit). Please wait an hour and try again."
    );
  return fallback;
}
