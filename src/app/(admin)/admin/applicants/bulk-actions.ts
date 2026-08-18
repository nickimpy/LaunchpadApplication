"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { field } from "@/utils/validation";
import { DECISION_VALUES } from "@/utils/decision-options";

export type BulkState = {
  error?: string;
  success?: string;
  /** Rows the action didn't apply to, so nothing looks silently dropped. */
  skipped?: string;
};

const DENIED = "You don't have permission to do that.";

/** Everything staff can do to a batch at once. */
export const BULK_ACTIONS = [
  { value: "verify_5", label: "Mark C2L Step 5 verified" },
  { value: "verify_6", label: "Mark C2L Step 6 verified" },
  { value: "flag_5", label: "Flag C2L Step 5 incomplete" },
  { value: "flag_6", label: "Flag C2L Step 6 incomplete" },
  { value: "track_a", label: "Set interview track A" },
  { value: "track_b", label: "Set interview track B" },
  { value: "decision", label: "Record a decision" },
] as const;

const ACTION_VALUES: readonly string[] = BULK_ACTIONS.map((a) => a.value);

/**
 * Applies one action to many applicants.
 *
 * Two deliberate choices:
 *  - Each application gets its OWN audit entry, not one "bulk" entry, so a
 *    student's history reads the same whether they were touched individually
 *    or as part of a batch.
 *  - Rows the action can't apply to are skipped and counted rather than
 *    forced, and the count comes back to the caller. Silently doing nothing to
 *    half a selection is how staff lose trust in a bulk tool.
 *
 * Releasing decisions is deliberately NOT bulk-able: revealing an outcome to a
 * cohort is irreversible and belongs on the individual profile.
 */
export async function bulkApply(
  _prev: BulkState,
  formData: FormData,
): Promise<BulkState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const action = field(formData, "bulk_action");
  const note = field(formData, "bulk_note");
  const decisionStatus = field(formData, "bulk_decision");

  if (ids.length === 0) return { error: "Select at least one applicant." };
  if (!ACTION_VALUES.includes(action)) return { error: "Choose an action." };

  const supabase = createClient(await cookies());
  const now = new Date().toISOString();
  let changed = 0;
  const skipped: string[] = [];

  // ---- C2L verify / flag ------------------------------------------------
  if (action.startsWith("verify_") || action.startsWith("flag_")) {
    const stepNumber = Number(action.split("_")[1]);
    const verifying = action.startsWith("verify_");
    if (!verifying && !note.trim()) {
      return { error: "Say what's missing — the students will see this note." };
    }

    const { data: rows } = await supabase
      .from("step_progress")
      .select("application_id, status, submitted_at")
      .in("application_id", ids)
      .eq("step_number", stepNumber);

    for (const row of rows ?? []) {
      // Only touch steps the student has actually reported: marking an
      // un-reported step verified would invent a submission.
      if (row.status === "not_started") {
        skipped.push(row.application_id as string);
        continue;
      }
      const { error } = await supabase
        .from("step_progress")
        .update({
          status: verifying ? "complete" : "needs_attention",
          submitted_at: row.submitted_at ?? now,
          completed_at: verifying ? now : null,
          staff_note: verifying ? null : note.trim(),
          updated_by: admin.id,
        })
        .eq("application_id", row.application_id)
        .eq("step_number", stepNumber);
      if (error) {
        return {
          error: `Stopped after ${changed} — ${error.message} (migration 0008 may not be applied yet)`,
        };
      }
      changed += 1;
      await logAdminAction({
        actor: admin,
        action: verifying ? "c2l.review.verified" : "c2l.review.incomplete",
        entityType: "application",
        entityId: row.application_id as string,
        before: { status: row.status },
        after: { step_number: stepNumber, bulk: true },
      });
    }
  }

  // ---- Interview track ---------------------------------------------------
  else if (action === "track_a" || action === "track_b") {
    const track = action === "track_a" ? "A" : "B";
    for (const id of ids) {
      const { error } = await supabase
        .from("applications")
        // Set by a human, so mark it overridden — auto-assignment must not
        // undo this later.
        .update({ track, track_overridden: true })
        .eq("id", id);
      if (error) return { error: `Stopped after ${changed} — ${error.message}` };
      changed += 1;
      await logAdminAction({
        actor: admin,
        action: "application.track_update",
        entityType: "application",
        entityId: id,
        after: { track, bulk: true },
      });
    }
  }

  // ---- Decisions (recorded, never released in bulk) ----------------------
  else if (action === "decision") {
    if (!DECISION_VALUES.includes(decisionStatus)) {
      return { error: "Choose which decision to record." };
    }
    const { data: existing } = await supabase
      .from("decisions")
      .select("application_id, released_at")
      .in("application_id", ids);
    const releasedAt = new Map(
      (existing ?? []).map((d) => [d.application_id as string, d.released_at as string | null]),
    );

    for (const id of ids) {
      const { error } = await supabase.from("decisions").upsert(
        {
          application_id: id,
          status: decisionStatus,
          notes: note.trim() || null,
          decided_by: admin.id,
          decided_at: now,
          // Preserve release state: this records, it never reveals.
          released_at: releasedAt.get(id) ?? null,
        },
        { onConflict: "application_id" },
      );
      if (error) return { error: `Stopped after ${changed} — ${error.message}` };
      changed += 1;
      await logAdminAction({
        actor: admin,
        action: "decision.record",
        entityType: "application",
        entityId: id,
        after: { status: decisionStatus, bulk: true },
      });
    }
  }

  revalidatePath("/admin/applicants");

  const label = BULK_ACTIONS.find((a) => a.value === action)?.label ?? action;
  return {
    success: `${label} — applied to ${changed} applicant${changed === 1 ? "" : "s"}.`,
    skipped: skipped.length
      ? `${skipped.length} skipped because the student hasn't reported that step yet.`
      : undefined,
  };
}
