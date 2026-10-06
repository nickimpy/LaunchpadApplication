import "server-only";
import type { AuthError } from "@supabase/supabase-js";

// Turns a Supabase Auth error into something an applicant can act on. Every
// auth action routes its errors through here so "try again" is only ever the
// answer when trying again would actually help.
//
// Codes: https://supabase.com/docs/guides/auth/debugging/error-codes

/** Messages for the codes we know how to explain. */
const AUTH_MESSAGES: Record<string, string> = {
  // Sending email
  over_email_send_rate_limit:
    "We've sent a lot of emails in a short time. Please wait a few minutes, then try again.",
  over_request_rate_limit:
    "Too many attempts in a short time. Please wait a few minutes, then try again.",
  email_address_invalid:
    "That email address doesn't look right. Check it for typos.",
  email_address_not_authorized:
    "We can't send email to that address. Try a different email, or contact us.",

  // Accounts
  email_exists: "That email is already used by another Launchpad account.",
  user_already_exists: "That email is already used by another Launchpad account.",
  email_not_confirmed:
    "You still need to confirm your email. Check your inbox for the link we sent.",
  user_not_found: "We couldn't find an account with that email.",
  user_banned: "This account has been disabled. Contact us for help.",
  signup_disabled: "New accounts aren't being accepted right now.",

  // Passwords
  invalid_credentials: "That email or password doesn't match.",
  same_password:
    "That's the same as your current password. Choose a different one.",
  weak_password:
    "That password is too easy to guess. Try a longer one, or mix in numbers and symbols.",

  // Links and sessions
  otp_expired:
    "That link has expired or was already used. Request a fresh one.",
  flow_state_expired:
    "That link has expired. Request a fresh one.",
  session_expired: "Your session expired. Please log in again.",
  session_not_found: "Your session expired. Please log in again.",
  refresh_token_not_found: "Your session expired. Please log in again.",
  reauthentication_needed:
    "For security, please log out and log back in, then try that again.",
};

/**
 * The friendliest accurate message for `error`, or `fallback` when the code
 * isn't one we recognise. Unrecognised errors are logged with their real code
 * so they show up in the Vercel logs instead of disappearing behind "try again".
 */
export function authErrorMessage(error: AuthError, fallback: string): string {
  const code = error.code ?? "";
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];

  // A dropped connection to Supabase surfaces as a fetch failure, not a code.
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT/i.test(error.message)) {
    return "We couldn't reach our server. Check your internet connection and try again.";
  }

  console.error("auth error", { code, status: error.status, message: error.message });
  return fallback;
}

/** Kept for existing call sites — every email-sending action uses this name. */
export const emailSendErrorMessage = authErrorMessage;
