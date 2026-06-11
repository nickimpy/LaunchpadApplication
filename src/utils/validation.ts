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
