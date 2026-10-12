import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SettingsForm } from "@/components/admin/settings-form";
import { ALL_SETTING_KEYS, type SettingsValues } from "@/utils/settings-options";
import { STEPS } from "@/utils/steps";

export const metadata: Metadata = { title: "Settings — Launchpad Admin" };

/**
 * Cycle settings staff can edit without SQL: contact email, cohort name, the
 * age rule, summer dates/location, C2L links, the parent form's program info,
 * both consent texts, and the step due dates. The admin layout already gates
 * this route to active staff; the save action re-checks.
 */
export default async function SettingsPage() {
  const supabase = createClient(await cookies());
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  const { data: rows } = await supabase
    .from("cycle_settings")
    .select("key, value")
    .eq("cycle_id", cycle?.id ?? "");
  const map = new Map((rows ?? []).map((r) => [r.key as string, r.value as unknown]));

  const initial: SettingsValues = { settings: {}, deadlines: {} };
  for (const key of ALL_SETTING_KEYS) {
    const v = map.get(key);
    initial.settings[key] = v == null ? "" : String(v);
  }
  const deadlines = (map.get("step_deadlines") ?? {}) as Record<string, string>;
  for (const step of STEPS) initial.deadlines[step.number] = deadlines[String(step.number)] ?? "";

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-9 text-xs">
        For the {cycle?.name ?? "current"} application cycle. Changes take effect
        immediately for everyone and are recorded in the activity log.
      </p>
      {cycle ? (
        <SettingsForm initial={initial} />
      ) : (
        <p>There&apos;s no active cycle configured.</p>
      )}
    </>
  );
}
