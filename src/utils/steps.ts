// Step metadata + dependency rules for the 7-step application (PRD: Student
// Portal). Decided dependency map: Step 1 unlocks Steps 2–6 (parallel);
// Step 7 is admin-only — visible to students but never student-actionable.

export type StepStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "pending_verification"
  // Staff looked at a C2L step and found it wrong or incomplete. Only staff can
  // set it (see step_progress RLS); students can move OUT of it by re-reporting,
  // which is the whole point.
  | "needs_attention"
  | "complete";

export type StepOwner = "student" | "parent" | "staff";

export type StepMeta = {
  number: number;
  name: string;
  owner: StepOwner;
  /** Steps a student may move themselves (matches step_progress RLS). */
  studentActionable: boolean;
  /** Highest status a student may set (RLS caps 5/6 below 'complete'). */
  maxStudentStatus: StepStatus | null;
  /** One-line description shown on the step page. */
  summary: string;
};

export const STEPS: StepMeta[] = [
  {
    number: 1,
    name: "Student Information",
    owner: "student",
    studentActionable: true,
    maxStudentStatus: "complete",
    summary:
      "Tell us about yourself: contact details, school, program choice, and your parent or guardian's contact information.",
  },
  {
    number: 2,
    name: "Parent / Guardian Form",
    owner: "parent",
    studentActionable: false,
    maxStudentStatus: null,
    summary:
      "Your parent or guardian completes a short form — no account needed. They get the link by email or text once you finish Step 1, and you can share it with them too.",
  },
  {
    number: 3,
    name: "Short Answer Questions",
    owner: "student",
    studentActionable: true,
    maxStudentStatus: "complete",
    summary:
      "A few short written questions so we can get to know you. You can save your answers and come back anytime.",
  },
  {
    number: 4,
    name: "Interview",
    owner: "staff",
    studentActionable: false,
    maxStudentStatus: null,
    summary:
      "An interview at your school or at Launchpad. Launchpad staff record the outcome here when it's done.",
  },
  {
    number: 5,
    name: "C2LPHL Application",
    owner: "student",
    studentActionable: true,
    maxStudentStatus: "pending_verification",
    summary:
      "Apply to Career Connected Learning PHL (C2LPHL) on their website and mark Launchpad as your top choice, then report it here. Launchpad staff verify it.",
  },
  {
    number: 6,
    name: "C2LPHL Required Documents",
    owner: "student",
    studentActionable: true,
    maxStudentStatus: "pending_verification",
    summary:
      "Upload your required documents in the C2LPHL system, then report it here. Launchpad staff verify it.",
  },
  {
    number: 7,
    name: "Admissions Decision",
    owner: "staff",
    studentActionable: false,
    maxStudentStatus: null,
    summary:
      "Launchpad staff review your completed application and make a decision. You'll get an email when your decision is ready to view here.",
  },
];

export const TOTAL_STEPS = STEPS.length;

export function getStepMeta(stepNumber: number): StepMeta | undefined {
  return STEPS.find((s) => s.number === stepNumber);
}

/**
 * Dependency map: Steps 2–6 stay locked until Step 1 is complete. Step 7 is
 * never locked (it's always visible) but is staff-only — see `studentActionable`.
 */
export function isStepLocked(
  stepNumber: number,
  step1Status: StepStatus,
): boolean {
  return stepNumber >= 2 && stepNumber <= 6 && step1Status !== "complete";
}

export const STATUS_LABELS: Record<StepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  pending_verification: "Pending staff review",
  needs_attention: "Needs your attention",
  complete: "Complete",
};

/** Staff-facing wording for the same states, from the reviewer's side. */
export const STAFF_STATUS_LABELS: Record<StepStatus, string> = {
  ...STATUS_LABELS,
  pending_verification: "Pending staff review",
  needs_attention: "Reviewed — incomplete",
  complete: "Reviewed — verified",
};

/** Statuses a student is allowed to set on a step (mirrors the RLS policy). */
export function studentAllowedStatuses(stepNumber: number): StepStatus[] {
  const meta = getStepMeta(stepNumber);
  if (!meta?.studentActionable || !meta.maxStudentStatus) return [];
  if (meta.maxStudentStatus === "complete") {
    return [
      "not_started",
      "in_progress",
      "submitted",
      "pending_verification",
      "complete",
    ];
  }
  // Deliberately excludes "needs_attention": only staff flag a step as
  // incomplete, mirroring step_progress_own_update's WITH CHECK list.
  return ["not_started", "in_progress", "submitted", "pending_verification"];
}

/** Everything a page or the sidebar needs to render one step. */
export type StepView = StepMeta & {
  status: StepStatus;
  locked: boolean;
  /** ISO date (YYYY-MM-DD) from cycle_settings.step_deadlines, if set. */
  deadline: string | null;
};

/** Format a YYYY-MM-DD deadline without timezone drift. */
export function formatDeadline(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
