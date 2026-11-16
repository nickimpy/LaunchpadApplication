"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { dbErrorMessage } from "@/utils/db-errors";
import { field } from "@/utils/validation";
import { STAFF_ARCHIVE_REASONS } from "@/utils/archive-options";
import type { AdminFormState } from "./[id]/actions";

const DENIED = "You don't have permission to do that.";
const failed = (error: { code?: string; message?: string }, what: string) =>
  dbErrorMessage(error, { audience: "staff", action: what });

const refresh = (applicationId?: string) => {
  revalidatePath("/admin", "layout");
  if (applicationId) revalidatePath(`/admin/applicants/${applicationId}`);
};

/**
 * Archive one application: it leaves the active pipeline (list, counts,
 * charts, reminders) but nothing is deleted and it can be restored.
 * "Withdrew" also records the Withdrew decision (unreleased) so decision and
 * funder reporting stay consistent.
 */
export async function archiveApplication(
  applicationId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const reason = field(formData, "reason");
  const note = field(formData, "note");
  if (!STAFF_ARCHIVE_REASONS.some((r) => r.value === reason)) {
    return { error: "Choose why this application is being archived." };
  }
  if ((reason === "other" || reason === "withdrew") && !note) {
    return {
      error:
        reason === "withdrew"
          ? "Add a short note (e.g. who told you and when) so the record explains itself."
          : "Say why, so whoever finds this later understands.",
    };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("applications")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: admin.id,
      archive_reason: reason,
      archive_note: note || null,
      duplicate_of: null,
    })
    .eq("id", applicationId);
  if (error) return { error: failed(error, "archive the application") };

  if (reason === "withdrew") {
    const { data: existing } = await supabase
      .from("decisions")
      .select("released_at")
      .eq("application_id", applicationId)
      .maybeSingle();
    const { error: decisionError } = await supabase.from("decisions").upsert(
      {
        application_id: applicationId,
        status: "withdrew",
        notes: note,
        decided_by: admin.id,
        decided_at: new Date().toISOString(),
        // Recording, never revealing: keep whatever release state it had.
        released_at: existing?.released_at ?? null,
      },
      { onConflict: "application_id" },
    );
    if (decisionError) {
      return {
        error: `Archived, but the Withdrew decision didn't save: ${failed(decisionError, "record the decision")}`,
      };
    }
  }

  await logAdminAction({
    actor: admin,
    action: "application.archive",
    entityType: "application",
    entityId: applicationId,
    after: { reason, note },
  });
  refresh(applicationId);
  return { success: "Archived. It's out of the active list and reminders; restore it any time." };
}

/** Put an archived application back into the active pipeline. */
export async function restoreApplication(
  applicationId: string,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("applications")
    .select("archive_reason, archive_note, duplicate_of")
    .eq("id", applicationId)
    .maybeSingle();
  const { error } = await supabase
    .from("applications")
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
      archive_note: null,
      duplicate_of: null,
    })
    .eq("id", applicationId);
  if (error) return { error: failed(error, "restore the application") };

  await logAdminAction({
    actor: admin,
    action: "application.restore",
    entityType: "application",
    entityId: applicationId,
    before,
  });
  refresh(applicationId);
  return {
    success:
      before?.archive_reason === "withdrew"
        ? "Restored. Note: the Withdrew decision is still recorded — change it in the decision panel if needed."
        : "Restored to the active pipeline.",
  };
}

/**
 * Possible duplicates: keep one record, archive the rest as duplicates of it.
 * Nothing is merged or deleted — the kept record is the one staff work with.
 */
export async function keepDuplicate(
  keepId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const others = formData.getAll("group_ids").map(String).filter((id) => id && id !== keepId);
  if (others.length === 0) return { error: "Nothing to archive." };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("applications")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: admin.id,
      archive_reason: "duplicate",
      archive_note: "Duplicate account — staff kept another record for this person.",
      duplicate_of: keepId,
    })
    .in("id", others);
  if (error) return { error: failed(error, "archive the duplicates") };

  for (const id of others) {
    await logAdminAction({
      actor: admin,
      action: "application.archive",
      entityType: "application",
      entityId: id,
      after: { reason: "duplicate", duplicate_of: keepId },
    });
  }
  refresh();
  return {
    success: `Kept 1 record and archived ${others.length} ${others.length === 1 ? "duplicate" : "duplicates"}.`,
  };
}

/** Possible duplicates: staff confirmed these are different people. */
export async function dismissDuplicates(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const ids = formData.getAll("group_ids").map(String).filter(Boolean);
  if (ids.length < 2) return { error: "Nothing to dismiss." };

  const rows: { app_a: string; app_b: string; dismissed_by: string }[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
      rows.push({ app_a: a, app_b: b, dismissed_by: admin.id });
    }
  }
  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("duplicate_dismissals")
    .upsert(rows, { onConflict: "app_a,app_b", ignoreDuplicates: true });
  if (error) return { error: failed(error, "mark these as different people") };

  for (const id of ids) {
    await logAdminAction({
      actor: admin,
      action: "duplicates.dismiss",
      entityType: "application",
      entityId: id,
      after: { not_duplicate_of: ids.filter((x) => x !== id) },
    });
  }
  refresh();
  return { success: "Marked as different people — they won't be suggested again." };
}
