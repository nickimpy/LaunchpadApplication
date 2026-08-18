"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { field } from "@/utils/validation";
import { DECISION_VALUES, type DecisionState } from "@/utils/decision-options";
import { isC2LStep } from "@/utils/c2l-options";

const DENIED = "You don't have permission to do that.";
const FAILED = "That didn't save. Please try again.";

export type VerifyState = { error?: string; success?: string };

/** The three states a reviewer can leave a C2L step in. */
export type C2LOutcome = "pending" | "verified" | "incomplete";

const OUTCOME_STATUS = {
  pending: "pending_verification",
  verified: "complete",
  incomplete: "needs_attention",
} as const;

/**
 * Records the result of staff reviewing a C2L step (5 or 6).
 *
 * Three outcomes, because "I haven't looked yet" and "I looked and it was
 * wrong" are different facts and the student needs to be able to tell them
 * apart:
 *   pending    — self-reported, not yet reviewed
 *   verified   — checked against C2LPHL and correct
 *   incomplete — checked and something is missing; `staff_note` says what,
 *                and the student can fix it and re-report
 *
 * Written directly rather than through `setStepStatus()`, which caps students
 * below `complete` for exactly these steps and never allows `needs_attention`.
 */
export async function reviewC2LStep(
  applicationId: string,
  stepNumber: number,
  outcome: C2LOutcome,
  staffNote: string,
): Promise<VerifyState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };
  if (!isC2LStep(stepNumber)) return { error: FAILED };
  if (!(outcome in OUTCOME_STATUS)) return { error: FAILED };

  // Flagging a problem without saying what it is leaves the student stuck.
  if (outcome === "incomplete" && !staffNote.trim()) {
    return { error: "Say what's missing, so the student knows what to fix." };
  }

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("step_progress")
    .select("status, submitted_at, staff_note")
    .eq("application_id", applicationId)
    .eq("step_number", stepNumber)
    .maybeSingle();

  const status = OUTCOME_STATUS[outcome];
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("step_progress")
    .update({
      status,
      // Preserve when the student reported it; that isn't ours to reset.
      submitted_at: before?.submitted_at ?? now,
      completed_at: status === "complete" ? now : null,
      // The note only belongs to the "incomplete" state; clear it otherwise so
      // a stale message can't linger after the student fixes things.
      staff_note: outcome === "incomplete" ? staffNote.trim() : null,
      updated_by: admin.id,
    })
    .eq("application_id", applicationId)
    .eq("step_number", stepNumber);
  if (error) {
    // The 'needs_attention' value and staff_note column arrive in migration
    // 0008; say so plainly rather than showing a generic failure.
    return {
      error: `${FAILED} (If this keeps happening, migration 0008 may not be applied yet: ${error.message})`,
    };
  }

  await logAdminAction({
    actor: admin,
    action: `c2l.review.${outcome}`,
    entityType: "application",
    entityId: applicationId,
    before,
    after: { step_number: stepNumber, status, staff_note: staffNote.trim() || null },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  const messages: Record<C2LOutcome, string> = {
    pending: `Step ${stepNumber} moved back to pending staff review.`,
    verified: `Step ${stepNumber} verified.`,
    incomplete: `Step ${stepNumber} flagged as incomplete — the student can see your note and re-report.`,
  };
  return { success: messages[outcome] };
}

/**
 * Records an admissions decision. Recording does NOT reveal it — the student
 * can't read the row until `released_at` is set, which RLS enforces
 * (`decisions_student_released`), not just the UI.
 */
export async function recordDecision(
  applicationId: string,
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const status = field(formData, "status");
  const notes = field(formData, "notes");
  if (!DECISION_VALUES.includes(status)) return { error: "Choose a decision." };

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("decisions")
    .select("status, notes, released_at")
    .eq("application_id", applicationId)
    .maybeSingle();

  const { error } = await supabase.from("decisions").upsert(
    {
      application_id: applicationId,
      status,
      notes: notes || null,
      decided_by: admin.id,
      decided_at: new Date().toISOString(),
      // Changing the decision after release keeps it visible — the student has
      // already been told, so silently re-hiding it would be worse.
      released_at: before?.released_at ?? null,
    },
    { onConflict: "application_id" },
  );
  if (error) return { error: FAILED };

  await logAdminAction({
    actor: admin,
    action: before ? "decision.update" : "decision.record",
    entityType: "application",
    entityId: applicationId,
    before,
    after: { status, notes: notes || null },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return {
    success: before?.released_at
      ? "Decision updated. It was already released, so the student sees the change."
      : "Decision recorded. The student cannot see it until you release it.",
  };
}

/**
 * Releases a decision to the student. Stamping `released_at` is what makes the
 * row readable to them at all.
 *
 * Phase 9 will send the decision email from here; for now this only reveals it
 * in the portal, which is why the UI says so.
 */
export async function releaseDecision(
  applicationId: string,
): Promise<DecisionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const supabase = createClient(await cookies());
  const { data: decision } = await supabase
    .from("decisions")
    .select("status, released_at")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!decision) return { error: "Record a decision first." };
  if (decision.released_at) return { error: "This decision is already released." };

  const { error } = await supabase
    .from("decisions")
    .update({ released_at: new Date().toISOString(), released_by: admin.id })
    .eq("application_id", applicationId);
  if (error) return { error: FAILED };

  // Step 7 completes on release, not on recording: the step is the student's
  // view of the process, and nothing has happened for them until now.
  const now = new Date().toISOString();
  await supabase
    .from("step_progress")
    .update({ status: "complete", submitted_at: now, completed_at: now, updated_by: admin.id })
    .eq("application_id", applicationId)
    .eq("step_number", 7);

  await logAdminAction({
    actor: admin,
    action: "decision.release",
    entityType: "application",
    entityId: applicationId,
    after: { status: decision.status },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return { success: "Decision released — the student can now see it in their portal." };
}
