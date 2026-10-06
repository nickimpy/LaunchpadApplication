"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorMessage } from "@/utils/auth-errors";
import { dbErrorMessage } from "@/utils/db-errors";
import { isTooOldToEnroll } from "@/utils/eligibility";
import { ageIneligibleText } from "@/utils/age-copy";
import { getOrigin } from "@/utils/origin";
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

  const { tooOld, maxAge } = await isTooOldToEnroll(values.date_of_birth);
  if (tooOld) return { errors: { date_of_birth: ageIneligibleText(maxAge) } };

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
    return {
      errors: {
        form: dbErrorMessage(updateError, {
          audience: "student",
          action: "save your profile changes",
        }),
      },
    };

  // Changing the login email needs confirmation: Supabase emails the NEW
  // address a link (via /auth/confirm, type=email_change) and the change only
  // takes effect once it's clicked. The students.email row is synced then.
  let emailPending: string | undefined;
  if (values.email !== (user.email ?? "").toLowerCase()) {
    // Check first: Supabase can be vague about an address that's already
    // registered, and applicants need to hear plainly that it's taken. Uses the
    // service role because RLS only lets a student see their own row.
    const { data: taken } = await createAdminClient()
      .from("students")
      .select("id")
      .eq("email", values.email)
      .neq("id", user.id)
      .maybeSingle();
    if (taken) {
      return {
        errors: {
          email:
            "That email is already used by another Launchpad account. Use a different email, or log in to that account instead.",
        },
      };
    }

    const { error: emailErr } = await supabase.auth.updateUser(
      { email: values.email },
      { emailRedirectTo: `${await getOrigin()}/auth/callback?next=/profile` },
    );
    if (emailErr)
      return {
        errors: {
          email: authErrorMessage(
            emailErr,
            "We couldn't send the confirmation email to that address. Check it for typos and try again.",
          ),
        },
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
