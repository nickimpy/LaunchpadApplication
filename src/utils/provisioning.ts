import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import type { NotificationPreference } from "@/utils/validation";

export type StudentSeed = {
  id: string; // auth user id
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string; // YYYY-MM-DD
  notificationPreference: NotificationPreference;
};

// Creates the student's row, their application for the active cycle, and the
// 7 step_progress rows. Runs with the service role because at signup the
// email isn't confirmed yet, so there is no session for RLS to authorize.
// Idempotent: safe to re-run as the self-heal path on first login.
export async function ensureStudentRecords(
  seed: StudentSeed,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error: studentError } = await admin.from("students").upsert(
    {
      id: seed.id,
      email: seed.email,
      first_name: seed.firstName,
      last_name: seed.lastName,
      phone: seed.phone,
      date_of_birth: seed.dateOfBirth,
      notification_preference: seed.notificationPreference,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (studentError) return { error: studentError.message };

  const { data: cycle, error: cycleError } = await admin
    .from("cycles")
    .select("id")
    .eq("is_active", true)
    .single();
  if (cycleError || !cycle) return { error: "No active cycle found." };

  const { data: application, error: applicationError } = await admin
    .from("applications")
    .upsert(
      { student_id: seed.id, cycle_id: cycle.id },
      { onConflict: "student_id,cycle_id" },
    )
    .select("id")
    .single();
  if (applicationError || !application)
    return { error: applicationError?.message ?? "Application not created." };

  const steps = Array.from({ length: 7 }, (_, i) => ({
    application_id: application.id,
    step_number: i + 1,
  }));
  const { error: stepsError } = await admin.from("step_progress").upsert(steps, {
    onConflict: "application_id,step_number",
    ignoreDuplicates: true,
  });
  if (stepsError) return { error: stepsError.message };

  return {};
}
