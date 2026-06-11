"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";
import { ensureStudentRecords } from "@/utils/provisioning";
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
        form: "Something went wrong creating your account. Please try again.",
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
