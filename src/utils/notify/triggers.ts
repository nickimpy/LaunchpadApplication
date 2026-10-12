import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { notify, alreadySent, sendDeferredSms } from "@/utils/notify/send";
import {
  emailOnly,
  stepComplete,
  stepReminder,
  startApplicationReminder,
  parentFormInvite,
  parentFormReminder,
  selfReleaseInvite,
  parentFormSigned,
  c2lFlagged,
  c2lVerified,
  interviewComplete,
  decisionReady,
  deadlineReminder,
  type RenderedMessage,
  type TemplateContext,
} from "@/utils/notify/templates";
import { STEPS, formatDeadline, getStepMeta, type StepStatus } from "@/utils/steps";
import { STEP3_MAX_WORDS, STEP3_MIN_WORDS } from "@/utils/step3-options";

// Every notification the app sends, one function per event (the full list is
// in CLAUDE.md, "Notifications"). Callers fire-and-forget: each function loads
// what it needs with the service role (so it works from the parent form and
// the cron, which have no session), and NEVER throws — a failed email must not
// undo or block the save that triggered it. Failures land in notification_log.
//
// Channels: the student's own preference (email / text / both). Parents get
// both. Confirmations are email-only by decision (texting every receipt is
// noise). Texts only go out 9am–8pm ET; outside that they wait for the morning
// cron (see notify()).

const DEFAULT_CONTACT = "apply@launchpadphilly.org";

type Loaded = {
  applicationId: string;
  studentId: string;
  ctx: TemplateContext;
  student: { email: string | null; phone: string | null; preference: string | null };
  studentFullName: string;
  selfRelease: boolean;
  parentLinkUrl: string;
  guardians: { first_name: string; email: string | null; phone: string | null }[];
};

/** Everything a message needs about one application. Null if it's gone. */
async function load(applicationId: string, origin: string): Promise<Loaded | null> {
  const admin = createAdminClient();
  const { data: app } = await admin
    .from("applications")
    .select(
      `id, student_id, cycle_id, parent_link_token, self_release,
       students ( first_name, last_name, preferred_name, email, phone, notification_preference )`,
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return null;

  const student = app.students as unknown as {
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    notification_preference: string | null;
  } | null;
  if (!student) return null;

  const [{ data: contact }, { data: guardians }] = await Promise.all([
    admin
      .from("cycle_settings")
      .select("value")
      .eq("cycle_id", app.cycle_id)
      .eq("key", "contact_email")
      .maybeSingle(),
    admin
      .from("guardians")
      .select("first_name, email, phone")
      .eq("application_id", applicationId)
      .order("position"),
  ]);

  return {
    applicationId,
    studentId: app.student_id as string,
    ctx: {
      // Communications use the preferred name (PRD).
      firstName: student.preferred_name || student.first_name,
      contactEmail:
        typeof contact?.value === "string" && contact.value ? contact.value : DEFAULT_CONTACT,
      portalUrl: `${origin}/portal`,
    },
    student: {
      email: student.email,
      phone: student.phone,
      preference: student.notification_preference,
    },
    studentFullName: `${student.first_name} ${student.last_name}`.trim(),
    selfRelease: Boolean(app.self_release),
    parentLinkUrl: `${origin}/parent/${app.parent_link_token}`,
    guardians: (guardians ?? []).filter((g) => g.email || g.phone) as Loaded["guardians"],
  };
}

const toStudent = (l: Loaded, message: RenderedMessage, trigger: string) =>
  notify(
    {
      studentId: l.studentId,
      applicationId: l.applicationId,
      email: l.student.email,
      phone: l.student.phone,
      preference: l.student.preference,
    },
    message,
    trigger,
  );

const toGuardians = async (l: Loaded, message: RenderedMessage, trigger: string) => {
  for (const g of l.guardians) {
    await notify(
      { applicationId: l.applicationId, email: g.email, phone: g.phone, preference: "both" },
      message,
      trigger,
    );
  }
};

/** Wraps a trigger so nothing it does can ever throw into the caller. */
async function safely(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`notification trigger "${name}" failed`, error);
  }
}

// ---------------------------------------------------------------------------
// Immediate triggers
// ---------------------------------------------------------------------------

/** #1 / #1b / #3 — Step 1 submitted for the first time. */
export function onStep1Submitted(applicationId: string, origin: string) {
  return safely("step1_submitted", async () => {
    const l = await load(applicationId, origin);
    if (!l) return;

    await toStudent(
      l,
      emailOnly(
        stepComplete(l.ctx, { number: 1, name: "Student Information" }, {
          what: l.selfRelease
            ? "Sign your records release form (Step 2), then work through the remaining steps in any order."
            : "Your parent or guardian gets their form now. Meanwhile you can work through Steps 3, 5, and 6 in any order.",
          timeline: "Within the next week",
        }),
      ),
      "step1_submitted",
    );

    if (l.selfRelease) {
      await toStudent(
        l,
        selfReleaseInvite(l.ctx, { formUrl: l.parentLinkUrl }),
        "self_release_invite",
      );
    } else {
      await toGuardians(
        l,
        parentFormInvite(l.ctx, {
          studentName: l.studentFullName,
          parentLinkUrl: l.parentLinkUrl,
        }),
        "parent_form_invite",
      );
    }
  });
}

/** #2 — the parent signed Step 2 (not sent when the student signed their own). */
export function onParentFormSigned(applicationId: string, parentName: string, origin: string) {
  return safely("parent_form_signed", async () => {
    const l = await load(applicationId, origin);
    if (!l || l.selfRelease) return;
    await toStudent(l, parentFormSigned(l.ctx, { parentName }), "parent_form_signed");
  });
}

/** #3 — Step 3 submitted for the first time. Email only. */
export function onStep3Submitted(applicationId: string, origin: string) {
  return safely("step3_submitted", async () => {
    const l = await load(applicationId, origin);
    if (!l) return;
    await toStudent(
      l,
      emailOnly(
        stepComplete(l.ctx, { number: 3, name: "Short Answer Questions" }, {
          what: "Launchpad staff will read your answers as part of your application review.",
          timeline: "Before your interview",
        }),
      ),
      "step3_submitted",
    );
  });
}

/** #3 — a C2L step reported (moved to pending review). Email only. */
export function onC2LReported(applicationId: string, stepNumber: 5 | 6, origin: string) {
  return safely("c2l_reported", async () => {
    const l = await load(applicationId, origin);
    if (!l) return;
    await toStudent(
      l,
      emailOnly(
        stepComplete(
          l.ctx,
          { number: stepNumber, name: getStepMeta(stepNumber)?.name ?? `Step ${stepNumber}` },
          {
            what: "Launchpad staff will check it against C2LPHL's records and mark it verified.",
            timeline: "Within about a week",
          },
        ),
      ),
      `c2l_step${stepNumber}_reported`,
    );
  });
}

/** #4 / #5 — staff reviewed a C2L step: flagged (email+text) or verified (email). */
export function onC2LReviewed(
  applicationId: string,
  stepNumber: 5 | 6,
  outcome: "verified" | "incomplete",
  note: string,
  origin: string,
) {
  return safely("c2l_reviewed", async () => {
    const l = await load(applicationId, origin);
    if (!l) return;
    const stepName = getStepMeta(stepNumber)?.name ?? `Step ${stepNumber}`;
    if (outcome === "incomplete") {
      await toStudent(
        l,
        c2lFlagged(l.ctx, { stepNumber, stepName, note }),
        `c2l_step${stepNumber}_flagged`,
      );
    } else {
      await toStudent(
        l,
        c2lVerified(l.ctx, { stepNumber, stepName }),
        `c2l_step${stepNumber}_verified`,
      );
    }
  });
}

/** #6 — interview recorded for the first time. Email only. */
export function onInterviewRecorded(applicationId: string, origin: string) {
  return safely("interview_recorded", async () => {
    const l = await load(applicationId, origin);
    if (!l) return;
    await toStudent(l, interviewComplete(l.ctx), "interview_complete");
  });
}

/** #7 — decision released. Email + text; never says what the decision is. */
export function onDecisionReleased(applicationId: string, origin: string) {
  return safely("decision_released", async () => {
    const l = await load(applicationId, origin);
    if (!l) return;
    await toStudent(l, decisionReady(l.ctx), "decision_released");
  });
}

/** Staff button: send the parent form link again (or to an updated contact). */
export async function resendParentInvite(
  applicationId: string,
  origin: string,
): Promise<{ sentTo: number; selfRelease: boolean }> {
  const l = await load(applicationId, origin);
  if (!l) return { sentTo: 0, selfRelease: false };
  if (l.selfRelease) {
    await toStudent(l, selfReleaseInvite(l.ctx, { formUrl: l.parentLinkUrl }), "self_release_resend");
    return { sentTo: 1, selfRelease: true };
  }
  await toGuardians(
    l,
    parentFormInvite(l.ctx, { studentName: l.studentFullName, parentLinkUrl: l.parentLinkUrl }),
    "parent_form_resend",
  );
  return { sentTo: l.guardians.length, selfRelease: false };
}

// ---------------------------------------------------------------------------
// Daily reminders (#8–#12) — run by the cron, each sent at most once
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (iso: string | null | undefined, now: number) =>
  iso ? (now - new Date(iso).getTime()) / DAY : -1;

/** What to do on a step, for the due-date reminder. */
const DUE_WHAT: Record<number, string> = {
  1: "It unlocks the rest of your application.",
  2: "Your parent or guardian's form (or your own records release) still needs signing.",
  3: `Three short written questions, ${STEP3_MIN_WORDS}–${STEP3_MAX_WORDS} words each.`,
  5: "Apply on c2lphl.org, then report it in your application.",
  6: "Upload your documents on C2LPHL, then report it in your application.",
};

export async function runDailyReminders(origin: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  // Texts parked overnight go first, now that it's daytime.
  const deferred = await sendDeferredSms();
  counts.deferred_sms_sent = deferred.sent;
  counts.deferred_sms_failed = deferred.failed;

  const admin = createAdminClient();
  const { data: cycle } = await admin
    .from("cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) return counts;

  const [{ data: apps }, { data: deadlineRow }] = await Promise.all([
    admin
      .from("applications")
      .select(
        `id, self_release,
         students ( created_at ),
         step_progress ( step_number, status, completed_at ),
         decisions ( status )`,
      )
      .eq("cycle_id", cycle.id),
    admin
      .from("cycle_settings")
      .select("value")
      .eq("cycle_id", cycle.id)
      .eq("key", "step_deadlines")
      .maybeSingle(),
  ]);
  const deadlines = (deadlineRow?.value ?? {}) as Record<string, string>;
  const now = Date.now();

  for (const app of apps ?? []) {
    const id = app.id as string;
    // Once there's any decision on file, application nudges stop.
    const decided = (app.decisions as unknown as { status: string }[] | { status: string } | null);
    if (Array.isArray(decided) ? decided.length > 0 : Boolean(decided)) continue;

    const rows = (app.step_progress ?? []) as {
      step_number: number;
      status: StepStatus;
      completed_at: string | null;
    }[];
    const status = (n: number) => rows.find((r) => r.step_number === n)?.status ?? "not_started";
    const completedAt = (n: number) => rows.find((r) => r.step_number === n)?.completed_at ?? null;
    const createdAt = (app.students as unknown as { created_at: string } | null)?.created_at;
    const selfRelease = Boolean(app.self_release);

    const once = async (trigger: string, send: (l: Loaded) => Promise<unknown>) => {
      if (await alreadySent(id, trigger)) return;
      const l = await load(id, origin);
      if (!l) return;
      await safely(trigger, async () => {
        await send(l);
      });
      bump(trigger);
    };

    // #8 — account a week old, Step 1 never started
    if (status(1) === "not_started" && daysSince(createdAt, now) >= 7) {
      await once("reminder_start", (l) =>
        toStudent(l, startApplicationReminder(l.ctx), "reminder_start"),
      );
    }

    if (status(1) === "complete") {
      const sinceStep1 = daysSince(completedAt(1), now);

      // #9 — short answers outstanding 3+ days after Step 1
      if (status(3) !== "complete" && sinceStep1 >= 3) {
        await once("reminder_step3", (l) =>
          toStudent(
            l,
            stepReminder(l.ctx, {
              number: 3,
              name: "Short Answer Questions",
              what: `three short written questions, ${STEP3_MIN_WORDS}–${STEP3_MAX_WORDS} words each.`,
            }),
            "reminder_step3",
          ),
        );
      }

      if (status(2) !== "complete" && sinceStep1 >= 3) {
        // #10 — nudge the student about Step 2
        await once("reminder_step2_student", (l) =>
          toStudent(
            l,
            stepReminder(l.ctx, {
              number: 2,
              name: selfRelease ? "Records Release Form" : "Parent / Guardian Form",
              what: selfRelease
                ? "you still need to sign your records release form."
                : "your parent or guardian hasn't signed their form yet. Remind them, or share the link from your application.",
            }),
            "reminder_step2_student",
          ),
        );
      }

      // #11 — remind the parent directly after a week
      if (!selfRelease && status(2) !== "complete" && sinceStep1 >= 7) {
        await once("reminder_parent", (l) =>
          toGuardians(
            l,
            parentFormReminder(l.ctx, {
              studentName: l.studentFullName,
              parentLinkUrl: l.parentLinkUrl,
            }),
            "reminder_parent",
          ),
        );
      }
    }

    // #12 — something due within 7 days and not done (student-facing steps).
    // Steps 2–6 only count once Step 1 is done (before that they're locked and
    // the Step 1 reminder covers it).
    for (const step of STEPS) {
      const due = deadlines[String(step.number)];
      if (!due || !DUE_WHAT[step.number]) continue;
      if (step.number !== 1 && status(1) !== "complete") continue;
      if (status(step.number) === "complete") continue;
      // A C2L step waiting on staff isn't the student's to finish.
      if (status(step.number) === "pending_verification") continue;
      const daysLeft = (new Date(`${due}T23:59:59-05:00`).getTime() - now) / DAY;
      if (daysLeft < 0 || daysLeft > 7) continue;
      const trigger = `reminder_due_step${step.number}`;
      await once(trigger, (l) =>
        toStudent(
          l,
          deadlineReminder(l.ctx, {
            stepNumber: step.number,
            stepName: step.number === 2 && selfRelease ? "Records Release Form" : step.name,
            due: formatDeadline(due),
            what: DUE_WHAT[step.number],
          }),
          trigger,
        ),
      );
    }
  }

  return counts;
}
