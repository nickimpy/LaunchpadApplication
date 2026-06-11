"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  dobError,
  emailError,
  field,
  nameError,
  phoneError,
  preferenceError,
  type FieldErrors,
} from "@/utils/validation";

export type ProfileState = {
  errors?: FieldErrors;
  success?: string;
  emailPending?: string;
};

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const values = {
    first_name: field(formData, "first_name"),
    last_name: field(formData, "last_name"),
    preferred_name: field(formData, "preferred_name"),
    phone: field(formData, "phone"),
    date_of_birth: field(formData, "date_of_birth"),
    notification_preference: field(formData, "notification_preference"),
    email: field(formData, "email").toLowerCase(),
  };

  const errors: FieldErrors = {};
  const checks = {
    first_name: nameError(values.first_name, "first name"),
    last_name: nameError(values.last_name, "last name"),
    phone: phoneError(values.phone),
    date_of_birth: dobError(values.date_of_birth),
    notification_preference: preferenceError(values.notification_preference),
    email: emailError(values.email),
  };
  for (const [name, message] of Object.entries(checks)) {
    if (message) errors[name] = message;
  }
  if (Object.keys(errors).length > 0) return { errors };

  const { error: updateError } = await supabase
    .from("students")
    .update({
      first_name: values.first_name,
      last_name: values.last_name,
      preferred_name: values.preferred_name || null,
      phone: values.phone,
      date_of_birth: values.date_of_birth,
      notification_preference: values.notification_preference,
    })
    .eq("id", user.id);
  if (updateError)
    return { errors: { form: "We couldn't save your changes. Please try again." } };

  // Changing the login email needs confirmation: Supabase emails the NEW
  // address a link (via /auth/confirm, type=email_change) and the change only
  // takes effect once it's clicked. The students.email row is synced then.
  let emailPending: string | undefined;
  if (values.email !== (user.email ?? "").toLowerCase()) {
    const { error: emailErr } = await supabase.auth.updateUser({
      email: values.email,
    });
    if (emailErr)
      return {
        errors: { email: "We couldn't start the email change. Try again." },
      };
    emailPending = values.email;
  }

  revalidatePath("/profile");
  return {
    success: "Your profile has been saved.",
    emailPending,
  };
}

export async function logout() {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  redirect("/login");
}
