import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ensureStudentRecords } from "@/utils/provisioning";
import type { NotificationPreference } from "@/utils/validation";
import { ProfileForm, type ProfileValues } from "./profile-form";

export const metadata: Metadata = { title: "Your profile — Launchpad" };

export default async function ProfilePage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: student } = await supabase
    .from("students")
    .select(
      "first_name, last_name, preferred_name, phone, date_of_birth, notification_preference, email",
    )
    .eq("id", user.id)
    .maybeSingle();

  // Self-heal: if the student row is missing (e.g. signup provisioning died
  // mid-way), rebuild it from the auth metadata stashed at signup.
  if (!student) {
    const meta = user.user_metadata ?? {};
    await ensureStudentRecords({
      id: user.id,
      email: user.email ?? "",
      firstName: meta.first_name ?? "",
      lastName: meta.last_name ?? "",
      phone: meta.phone ?? "",
      dateOfBirth: meta.date_of_birth ?? "",
      notificationPreference:
        (meta.notification_preference as NotificationPreference) ?? "email",
    });
    ({ data: student } = await supabase
      .from("students")
      .select(
        "first_name, last_name, preferred_name, phone, date_of_birth, notification_preference, email",
      )
      .eq("id", user.id)
      .maybeSingle());
  }

  const initial: ProfileValues = {
    first_name: student?.first_name ?? "",
    last_name: student?.last_name ?? "",
    preferred_name: student?.preferred_name ?? "",
    phone: student?.phone ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    notification_preference: student?.notification_preference ?? "email",
    email: student?.email ?? user.email ?? "",
  };

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Your profile</h1>
      <p className="mb-9">
        Keep your contact details up to date. We use your preferred name in all
        communications.
      </p>
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <ProfileForm initial={initial} />
      </div>
    </>
  );
}
