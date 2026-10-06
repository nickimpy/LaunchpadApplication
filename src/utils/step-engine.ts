import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { ensureStudentRecords } from "@/utils/provisioning";
import type { NotificationPreference } from "@/utils/validation";
import {
  STEPS,
  type StepStatus,
  type StepView,
  isStepLocked,
  getStepMeta,
  withSelfRelease,
  studentAllowedStatuses,
} from "@/utils/steps";

export type PortalData = {
  userId: string;
  student: {
    first_name: string;
    last_name: string;
    preferred_name: string | null;
  };
  applicationId: string;
  cycleId: string;
  cycleName: string;
  /** Public name of the cohort being recruited, e.g. "2027-28". */
  cohortLabel: string;
  contactEmail: string;
  /** 18+ applicant signing their own records release (Step 2 becomes theirs). */
  selfRelease: boolean;
  steps: StepView[];
  completedCount: number;
};

/**
 * Everything the portal shell needs: the student, their application for the
 * active cycle, all 7 step_progress rows, and the admin-editable deadlines
 * from cycle_settings. Cached per request so the layout (sidebar) and the
 * page can both call it with a single set of queries.
 *
 * Returns null when there is no session — callers redirect to /login.
 */
export const getPortalData = cache(async (): Promise<PortalData | null> => {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const loadStudent = () =>
    supabase
      .from("students")
      .select("first_name, last_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle();

  // Self-heal missing rows (student, application, step_progress) from the
  // auth metadata stashed at signup — same pattern as /profile.
  const heal = () => {
    const meta = user.user_metadata ?? {};
    return ensureStudentRecords({
      id: user.id,
      email: user.email ?? "",
      firstName: meta.first_name ?? "",
      lastName: meta.last_name ?? "",
      phone: meta.phone ?? "",
      dateOfBirth: meta.date_of_birth ?? "",
      notificationPreference:
        (meta.notification_preference as NotificationPreference) ?? "email",
    });
  };

  let { data: student } = await loadStudent();
  if (!student) {
    // Never self-heal a staff account into an applicant: admins have no
    // student row by design, and healing would silently file them into the
    // pipeline as a fake application. They get sent to /admin instead.
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (admin) return null;

    await heal();
    ({ data: student } = await loadStudent());
  }
  if (!student) return null;

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) throw new Error("No active application cycle is configured.");

  const loadApplication = () =>
    supabase
      .from("applications")
      .select("id, step_progress (step_number, status)")
      .eq("student_id", user.id)
      .eq("cycle_id", cycle.id)
      .maybeSingle();

  let { data: application } = await loadApplication();
  if (!application || application.step_progress.length < STEPS.length) {
    await heal();
    ({ data: application } = await loadApplication());
  }
  if (!application) throw new Error("Could not load your application.");

  // Deadlines ({"1": "YYYY-MM-DD", ...}) and the contact address are
  // admin-editable cycle data, never hardcoded. Missing deadline entries
  // render as "no deadline yet".
  const { data: settingRows } = await supabase
    .from("cycle_settings")
    .select("key, value")
    .eq("cycle_id", cycle.id)
    .in("key", ["step_deadlines", "contact_email", "cohort_label"]);
  const settings = new Map(settingRows?.map((r) => [r.key, r.value]) ?? []);
  const deadlines = (settings.get("step_deadlines") ?? {}) as Record<
    string,
    string
  >;
  const contactEmail =
    typeof settings.get("contact_email") === "string" &&
    settings.get("contact_email")
      ? (settings.get("contact_email") as string)
      : "apply@launchpadphilly.org";
  // The cycle's own name ("2026-2027") is the application cycle; applicants
  // care which cohort they'd be joining, which starts the following summer.
  const cohortLabel =
    typeof settings.get("cohort_label") === "string" && settings.get("cohort_label")
      ? (settings.get("cohort_label") as string)
      : cycle.name;

  const statusByStep = new Map<number, StepStatus>(
    application.step_progress.map((row: { step_number: number; status: StepStatus }) => [
      row.step_number,
      row.status,
    ]),
  );
  const step1Status = statusByStep.get(1) ?? "not_started";

  // Its own query on purpose: the portal shell (sidebar on every page) must
  // keep working if this newer column isn't in the database yet, so an error
  // here just means "not self-releasing" instead of taking the whole portal down.
  const { data: releaseRow } = await supabase
    .from("applications")
    .select("self_release")
    .eq("id", application.id)
    .maybeSingle();
  const selfRelease = Boolean(releaseRow?.self_release);

  const steps: StepView[] = STEPS.map((base) => {
    const meta = selfRelease ? withSelfRelease(base) : base;
    return {
      ...meta,
      status: statusByStep.get(meta.number) ?? "not_started",
      locked: isStepLocked(meta.number, step1Status),
      deadline: deadlines[String(meta.number)] ?? null,
    };
  });

  return {
    userId: user.id,
    student,
    applicationId: application.id,
    cycleId: cycle.id,
    cycleName: cycle.name,
    cohortLabel,
    contactEmail,
    selfRelease,
    steps,
    completedCount: steps.filter((s) => s.status === "complete").length,
  };
});

/**
 * Move a student-owned step (1, 3, 5, 6) to a new status. Used by the step
 * forms in Phases 4–6 (start, submit, and re-open/edit after submit). The
 * same rules are enforced again by RLS — students can never touch steps
 * 2/4/7 and can never set 5/6 to 'complete' (staff verify those).
 */
export async function setStepStatus(
  stepNumber: number,
  status: StepStatus,
): Promise<{ error?: string }> {
  const meta = getStepMeta(stepNumber);
  if (!meta?.studentActionable)
    return { error: "Only Launchpad staff can update this step." };
  if (!studentAllowedStatuses(stepNumber).includes(status))
    return { error: "That status isn't allowed for this step." };

  const data = await getPortalData();
  if (!data) return { error: "You must be logged in." };
  if (isStepLocked(stepNumber, data.steps[0].status))
    return { error: "Complete Step 1 to unlock this step." };

  const submitted = status === "pending_verification" || status === "complete";
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("step_progress")
    .update({
      status,
      submitted_at: submitted ? new Date().toISOString() : null,
      completed_at: status === "complete" ? new Date().toISOString() : null,
      updated_by: data.userId,
    })
    .eq("application_id", data.applicationId)
    .eq("step_number", stepNumber);
  return error ? { error: error.message } : {};
}
