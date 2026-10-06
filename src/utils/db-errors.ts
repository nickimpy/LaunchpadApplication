// Turns a Supabase/PostgREST database error into a specific message. Used by
// every server action that writes, so a failed save says WHY instead of
// "please try again". Free of `server-only` so it can be unit-rendered.
//
// The raw error is always logged (Vercel → logs) because the user-facing text
// is deliberately plain and never shows Postgres internals.

export type DbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type Audience = "student" | "parent" | "staff";

export type DbErrorOptions = {
  /** Who's reading — staff get more technical detail than applicants. */
  audience: Audience;
  /** What was being done, for the log line and the fallback ("save your answers"). */
  action: string;
  /** Message for a duplicate (unique violation), when one is possible here. */
  duplicate?: string;
  /** Who to contact, for applicant-facing dead ends. */
  contactEmail?: string;
};

const contactLine = (email?: string) =>
  email ? ` If it keeps happening, email ${email}.` : "";

export function dbErrorMessage(error: DbError, opts: DbErrorOptions): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  const staff = opts.audience === "staff";

  console.error(`db error while trying to ${opts.action}`, {
    code,
    message,
    details: error.details,
    hint: error.hint,
  });

  // Lost connection to Supabase (or the free-tier project is waking up).
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|timeout/i.test(message)) {
    return "We couldn't reach our server — it may be waking up. Wait a few seconds and try again.";
  }

  switch (code) {
    // unique_violation
    case "23505":
      return opts.duplicate ?? "That already exists, so it wasn't saved again.";

    // insufficient_privilege, and PostgREST's row-level-security refusal
    case "42501":
    case "PGRST301":
    case "PGRST302":
      return staff
        ? "You don't have permission to do that. Your admin access may have been revoked, or your session expired — log out and back in."
        : "Your session may have expired. Please log out, log back in, and try again.";

    // JWT expired
    case "PGRST303":
      return "Your session expired. Please log out and log back in.";

    // undefined_column / undefined_table / invalid enum value: the database is
    // behind the code, almost always a migration that hasn't been pasted yet.
    case "42703":
    case "42P01":
    case "PGRST204":
    case "PGRST205":
      return staff
        ? `The database is missing an update this page needs (${message}). A migration in supabase/migrations probably hasn't been run yet.`
        : `This part of the application isn't fully set up on our end yet, so it couldn't be saved.${contactLine(opts.contactEmail)}`;

    // check_violation / not_null_violation
    case "23514":
      return "One of your answers isn't an allowed value. Check the highlighted fields and try again.";
    case "23502":
      return "A required answer is missing. Fill in every required field and try again.";

    // foreign_key_violation
    case "23503":
      return staff
        ? "That refers to something that no longer exists (it may have been deleted). Refresh the page and try again."
        : "Something you picked is no longer available. Refresh the page and choose again.";

    // invalid_text_representation / numeric_value_out_of_range / string too long
    case "22P02":
    case "22003":
    case "22001":
      return "One of your answers is in the wrong format or too long. Check the numbers and dates you entered.";

    // invalid enum value (e.g. a status the database doesn't know yet)
    case "22023":
      return staff
        ? `The database rejected a value (${message}). A migration may not have been run yet.`
        : `That couldn't be saved because of a setup problem on our end.${contactLine(opts.contactEmail)}`;
  }

  return `We couldn't ${opts.action}. Please try again.${contactLine(opts.contactEmail)}`;
}

/** Same idea for Supabase Storage (uploads, signature images, documents). */
export function storageErrorMessage(
  error: { message?: string; statusCode?: string | number },
  opts: DbErrorOptions,
): string {
  const message = error.message ?? "";
  console.error(`storage error while trying to ${opts.action}`, error);

  if (/row-level security|unauthori[sz]ed|403|permission/i.test(message)) {
    return opts.audience === "staff"
      ? "You don't have permission to upload there. Your admin access may have been revoked, or your session expired — log out and back in."
      : "Your session may have expired. Please log out, log back in, and try again.";
  }
  if (/too large|413|exceeded the maximum/i.test(message)) {
    return "That file is too large to upload. Try a smaller copy.";
  }
  if (/already exists|409/i.test(message)) {
    return "A file with that name is already stored. Rename it and upload again.";
  }
  if (/fetch failed|network|ECONNRESET|ETIMEDOUT|timeout/i.test(message)) {
    return "We couldn't reach our server. Check your connection and try again.";
  }
  return opts.audience === "staff"
    ? `We couldn't ${opts.action} (${message || "unknown storage error"}).`
    : `We couldn't ${opts.action}. Please try again.${contactLine(opts.contactEmail)}`;
}
