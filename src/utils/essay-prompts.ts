import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { STEP3_QUESTIONS } from "@/utils/step3-options";

/**
 * Makes the cycle's `essay_prompts` rows match STEP3_QUESTIONS exactly: one
 * active row per question (in order), and anything else deactivated — notably
 * the beta "Why do you want to join Launchpad?" placeholder. Deactivated rows
 * are kept, not deleted, so any answers already written against them survive
 * and still show up for staff.
 *
 * Idempotent and cheap when already in sync (one read, no writes), so it is
 * safe to call on every Step 3 load and save. Uses the service role because
 * students have read-only access to essay_prompts.
 */
export async function syncEssayPrompts(cycleId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("essay_prompts")
    .select("id, prompt, sort_order, is_active")
    .eq("cycle_id", cycleId);
  if (error) return; // fall through to whatever is there rather than blocking the page

  const existing = rows ?? [];
  const wanted = new Map<string, number>(
    STEP3_QUESTIONS.map((q, i) => [q, i + 1]),
  );

  // Retire anything that isn't one of the questions.
  const stale = existing.filter((r) => r.is_active && !wanted.has(r.prompt as string));
  if (stale.length > 0) {
    await admin
      .from("essay_prompts")
      .update({ is_active: false })
      .in("id", stale.map((r) => r.id as string));
  }

  for (const [prompt, order] of wanted) {
    const match = existing.find((r) => r.prompt === prompt);
    if (!match) {
      await admin
        .from("essay_prompts")
        .insert({ cycle_id: cycleId, prompt, sort_order: order, is_active: true });
    } else if (!match.is_active || match.sort_order !== order) {
      await admin
        .from("essay_prompts")
        .update({ is_active: true, sort_order: order })
        .eq("id", match.id as string);
    }
  }
}
