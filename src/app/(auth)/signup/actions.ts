"use server";

import { isSamePerson } from "@/utils/duplicates";
import { captchaToken } from "@/utils/captcha";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";
import { emailSendErrorMessage } from "@/utils/auth-errors";
import { ensureStudentRecords } from "@/utils/provisioning";
import { isTooOldToEnroll } from "@/utils/eligibility";
import {
  dobError,
  emailError,
  field,
  nameError,
  passwordError,
  phoneError,
  preferenceError,
  type FieldErrors,
  type NotificationPreference,
} from "@/utils/validation";

export type SignupState = {
  errors?: FieldErrors;
  values?: Record<string, string>;
  duplicate?: boolean;
  /**
   * An existing account looks like the same person (same birth date + same
   * name or phone): a masked hint of its email so they can recover it.
   */
  possibleExisting?: string;
  /** Set (to the cycle's max age) when the date of birth is too old to enroll. */
  ageIneligible?: { maxAge: number; ageAtStart: number };
};

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const values = {
    first_name: field(formData, "first_name"),
    last_name: field(formData, "last_name"),
    email: field(formData, "email").toLowerCase(),
    password: (formData.get("password") ?? "").toString(),
    date_of_birth: field(formData, "date_of_birth"),
    phone: field(formData, "phone"),
    notification_preference: field(formData, "notification_preference"),
  };
  // never echo the password back to the client
  const safeValues = { ...values, password: "" };

  // Honeypot: a field real people never see (hidden off-screen, skipped by
  // keyboard and screen readers). Form-filling bots fill every input. Pretend
  // it worked so the bot learns nothing, but create no account and send no email.
  if (field(formData, "company")) {
    console.warn("signup honeypot tripped", { email: values.email });
    redirect(`/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  const errors: FieldErrors = {};
  const checks = {
    first_name: nameError(values.first_name, "first name"),
    last_name: nameError(values.last_name, "last name"),
    email: emailError(values.email),
    password: passwordError(values.password),
    date_of_birth: dobError(values.date_of_birth),
    phone: phoneError(values.phone),
    notification_preference: preferenceError(values.notification_preference),
  };
  for (const [name, message] of Object.entries(checks)) {
    if (message) errors[name] = message;
  }
  if (Object.keys(errors).length > 0) return { errors, values: safeValues };

  // Eligibility is measured at enrollment (program start), not today. Checked
  // before the duplicate lookup and before any account exists, so an applicant
  // who is too old is told why instead of being created and left stranded.
  const { tooOld, maxAge, ageAtStart } = await isTooOldToEnroll(values.date_of_birth);
  if (tooOld) {
    return {
      ageIneligible: { maxAge, ageAtStart },
      errors: { date_of_birth: "This date of birth isn't eligible — see the note above." },
      values: safeValues,
    };
  }

  // Same person, different email? (By far the most common way duplicates
  // happen: the first verification email went unread, so they sign up again.)
  // Point them back to the account they already have — unless they've seen
  // this warning and chosen to continue, in which case the new account is
  // created and staff see it on the Possible duplicates screen.
  if (field(formData, "confirm_new_account") !== "yes") {
    const existing = await findLikelyExistingAccount({
      firstName: values.first_name,
      lastName: values.last_name,
      dateOfBirth: values.date_of_birth,
      phone: values.phone,
      email: values.email,
    });
    if (existing) return { possibleExisting: existing, values: safeValues };
  }

  // Duplicate check. Supabase's public API deliberately obfuscates whether an
  // email exists, so we check the students table with the service role.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("students")
    .select("id")
    .eq("email", values.email)
    .maybeSingle();
  if (existing) return { duplicate: true, values: safeValues };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      // default confirmation email lands here after Supabase verifies the token
      emailRedirectTo: `${await getOrigin()}/auth/callback`,
      captchaToken: captchaToken(formData),
      // kept in auth metadata so a half-finished signup can self-heal on
      // first login (see ensureStudentRecords call in /profile)
      data: {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        date_of_birth: values.date_of_birth,
        notification_preference: values.notification_preference,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists")
      return { duplicate: true, values: safeValues };
    return {
      errors: {
        form: emailSendErrorMessage(
          error,
          "Something went wrong creating your account. Please try again.",
        ),
      },
      values: safeValues,
    };
  }

  // With email confirmation on, Supabase returns a placeholder user with an
  // empty identities array instead of admitting the email is taken.
  if (data.user && data.user.identities?.length === 0)
    return { duplicate: true, values: safeValues };

  if (data.user) {
    const { error: provisionError } = await ensureStudentRecords({
      id: data.user.id,
      email: values.email,
      firstName: values.first_name,
      lastName: values.last_name,
      phone: values.phone,
      dateOfBirth: values.date_of_birth,
      notificationPreference:
        values.notification_preference as NotificationPreference,
    });
    // not fatal: the profile page re-runs provisioning from auth metadata
    if (provisionError) console.error("signup provisioning:", provisionError);
  }

  redirect(`/verify-email?email=${encodeURIComponent(values.email)}`);
}

/** "nicholas@gmail.com" → "ni•••@gmail.com" */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return user && domain ? `${user.slice(0, 2)}•••@${domain}` : "";
}

/**
 * A different-email account that looks like this person, as a masked email
 * hint, or null. Service role: runs before any session exists.
 */
async function findLikelyExistingAccount(p: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("students")
    .select("id, first_name, last_name, date_of_birth, phone, email")
    .eq("date_of_birth", p.dateOfBirth)
    .neq("email", p.email)
    .limit(50);
  const me = { id: "new", firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth, phone: p.phone };
  const match = (data ?? []).find((s) =>
    isSamePerson(me, {
      id: s.id as string,
      firstName: (s.first_name as string) ?? "",
      lastName: (s.last_name as string) ?? "",
      dateOfBirth: (s.date_of_birth as string) ?? null,
      phone: (s.phone as string) ?? null,
    }),
  );
  return match ? maskEmail(match.email as string) : null;
}
