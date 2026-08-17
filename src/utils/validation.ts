// Shared server-side form validation. Messages are written for applicants
// (ages 16-24), so keep them plain and specific.

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function emailError(email: string): string | null {
  if (!email) return "Enter your email address.";
  if (!EMAIL_RE.test(email))
    return "Enter a valid email address, like you@example.com.";
  return null;
}

export function passwordError(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < 8)
    return "Your password must be at least 8 characters.";
  return null;
}

export function nameError(value: string, label: string): string | null {
  if (!value) return `Enter your ${label}.`;
  return null;
}

export function phoneError(phone: string): string | null {
  if (!phone) return "Enter your phone number.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15)
    return "Enter a valid phone number with area code.";
  return null;
}

export function dobError(dob: string): string | null {
  if (!dob) return "Enter your date of birth.";
  const date = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Enter a valid date of birth.";
  const now = new Date();
  if (date > now) return "Date of birth can't be in the future.";
  const age =
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (age < 13) return "You must be at least 13 years old to create an account.";
  if (age > 100) return "Enter a valid date of birth.";
  return null;
}

export const NOTIFICATION_PREFERENCES = ["email", "sms", "both"] as const;
export type NotificationPreference = (typeof NOTIFICATION_PREFERENCES)[number];

export function preferenceError(value: string): string | null {
  if (!(NOTIFICATION_PREFERENCES as readonly string[]).includes(value))
    return "Choose how you'd like to receive updates.";
  return null;
}

// --- Step 1 (Student Information) --------------------------------------------

export function requiredError(value: string, label: string): string | null {
  if (!value) return `Enter your ${label}.`;
  return null;
}

/** A required dropdown / radio choice that must be one of `allowed`. */
export function choiceError(
  value: string,
  allowed: readonly string[],
  label: string,
): string | null {
  if (!value) return `Choose ${label}.`;
  if (!allowed.includes(value)) return `Choose a valid ${label}.`;
  return null;
}

export function gpaError(value: string): string | null {
  if (!value) return "Enter your GPA.";
  const n = Number(value);
  if (Number.isNaN(n)) return "Enter your GPA as a number, like 3.5.";
  if (n < 0 || n > 6) return "Enter a GPA between 0 and 6.";
  return null;
}

export function zipError(value: string): string | null {
  if (!value) return "Enter your ZIP code.";
  if (!/^\d{5}(-\d{4})?$/.test(value))
    return "Enter a 5-digit ZIP code, like 19107.";
  return null;
}

export function householdSizeError(value: string): string | null {
  if (!value) return "Enter the number of people in your household.";
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 30)
    return "Enter a whole number between 1 and 30.";
  return null;
}

/** A required multi-select needs at least one chosen option. */
export function multiSelectError(
  values: string[],
  label: string,
): string | null {
  if (values.length === 0) return `Choose at least one option for ${label}.`;
  return null;
}

// --- Step 2 (Parent / Guardian Form) -----------------------------------------
// These messages address the parent, not the student, so they don't reuse the
// "Enter your ..." phrasing above.

export function parentRequiredError(
  value: string,
  label: string,
): string | null {
  if (!value) return `Enter ${label}.`;
  return null;
}

export function parentEmailError(email: string): string | null {
  if (!email) return "Enter the best email address to reach you.";
  if (!EMAIL_RE.test(email))
    return "Enter a valid email address, like you@example.com.";
  return null;
}

export function parentPhoneError(phone: string): string | null {
  if (!phone) return "Enter the best phone number to reach you.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15)
    return "Enter a valid phone number with area code.";
  return null;
}

/** The concerns box is required only when availability isn't a plain "yes". */
export function availabilityConcernsError(
  availability: string,
  concerns: string,
): string | null {
  if (availability === "no" || availability === "not_sure") {
    if (!concerns) return "Tell us what conflicts or concerns you have.";
  }
  return null;
}

// Deliberately NOT an "is there ink on it?" check. A blank canvas and a real
// signature both compress to wildly different sizes depending on canvas
// resolution, so a byte threshold either rejects genuine faint signatures or
// accepts blank ones. Whether anything was actually drawn is decided on the
// client, which can inspect the canvas directly; the required typed legal name
// is the independently-validated part of the signature record either way.
// This is a structural sanity check: a real PNG, not absurdly large.
const MIN_PNG_BYTES = 100;
export const MAX_SIGNATURE_BYTES = 1_500_000; // well under the 2mb action limit

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** True when `buffer` is a structurally valid PNG of a sane size. */
export function isPlausiblePng(buffer: Buffer): boolean {
  if (buffer.length < MIN_PNG_BYTES) return false;
  if (buffer.length > MAX_SIGNATURE_BYTES) return false;
  return buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
}
