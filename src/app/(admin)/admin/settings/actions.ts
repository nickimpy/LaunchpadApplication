"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { dbErrorMessage } from "@/utils/db-errors";
import { emailError, field } from "@/utils/validation";
import { STEPS } from "@/utils/steps";
import {
  SETTING_GROUPS,
  deadlineField,
  type SettingsState,
  type SettingsValues,
} from "@/utils/settings-options";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Saves the cycle's editable settings. Runs through the staff member's own
 * session (cycle_settings is writable by is_admin() under RLS), validates every
 * field, writes only what changed, and audit-logs each change with before and
 * after — consent text is legal language, so who changed it and when matters.
 *
 * Note: editing consent text never alters forms already signed; each signed
 * form keeps a snapshot of the exact wording agreed to.
 */
export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "You don't have permission to do that." };

  const fields = SETTING_GROUPS.flatMap((g) => g.fields);
  const values: SettingsValues = { settings: {}, deadlines: {} };
  for (const f of fields) {
    // Long text keeps its line breaks; field() trims, which is what we want.
    values.settings[f.key] = field(formData, f.key);
  }
  for (const step of STEPS) values.deadlines[step.number] = field(formData, deadlineField(step.number));

  // --- validate ------------------------------------------------------------
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = values.settings[f.key];
    if (f.kind === "email") {
      const e = emailError(v);
      if (e) errors[f.key] = e;
    } else if (f.kind === "url" && v && !/^https:\/\/\S+$/i.test(v)) {
      errors[f.key] = "Enter a full web address starting with https://";
    } else if (f.kind === "date" && !DATE_RE.test(v)) {
      errors[f.key] = "Choose a date.";
    } else if (f.kind === "number") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 14 || n > 30) errors[f.key] = "Enter a whole number between 14 and 30.";
    } else if ((f.kind === "text" || f.kind === "longtext") && !v) {
      errors[f.key] = "This can't be blank.";
    }
  }
  for (const step of STEPS) {
    const d = values.deadlines[step.number];
    if (d && !DATE_RE.test(d)) errors[deadlineField(step.number)] = "Choose a date.";
  }
  if (Object.keys(errors).length) {
    return { errors, error: "Some settings need fixing — see the highlighted fields.", values };
  }

  // --- load current values, write only what changed --------------------------
  const supabase = createClient(await cookies());
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!cycle) return { error: "There's no active cycle to save settings for.", values };

  const { data: rows } = await supabase
    .from("cycle_settings")
    .select("key, value")
    .eq("cycle_id", cycle.id);
  const current = new Map((rows ?? []).map((r) => [r.key as string, r.value as unknown]));

  const next = new Map<string, unknown>();
  for (const f of fields) {
    const raw = values.settings[f.key];
    next.set(f.key, f.kind === "number" ? Number(raw) : raw);
  }
  const deadlines: Record<string, string> = {};
  for (const step of STEPS) {
    const d = values.deadlines[step.number];
    if (d) deadlines[String(step.number)] = d;
  }
  next.set("step_deadlines", deadlines);

  const changed = [...next.entries()].filter(
    ([key, value]) => JSON.stringify(current.get(key) ?? null) !== JSON.stringify(value),
  );
  if (changed.length === 0) return { success: "Nothing changed.", values };

  const { error } = await supabase.from("cycle_settings").upsert(
    changed.map(([key, value]) => ({ cycle_id: cycle.id, key, value })),
    { onConflict: "cycle_id,key" },
  );
  if (error) {
    return {
      error: dbErrorMessage(error, { audience: "staff", action: "save the settings" }),
      values,
    };
  }

  for (const [key, value] of changed) {
    await logAdminAction({
      actor: admin,
      action: "settings.update",
      entityType: "cycle_setting",
      entityId: cycle.id as string,
      before: { key, value: current.get(key) ?? null },
      after: { key, value },
    });
  }

  // Settings show up everywhere: steps, parent form, signup age rule.
  revalidatePath("/", "layout");
  return {
    success: `Saved ${changed.length} ${changed.length === 1 ? "change" : "changes"}.`,
    values,
  };
}
