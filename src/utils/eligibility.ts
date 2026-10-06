import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  DEFAULT_MAX_ENROLLMENT_AGE,
  DEFAULT_PROGRAM_START_DATE,
  exceedsMaxAge,
} from "@/utils/age";

export type AgeRule = { programStart: string; maxAge: number };

/**
 * The cycle's age rule. Read with the service role because signup runs before
 * there is a session; falls back to the defaults if the settings are missing so
 * a bad row can never wave an ineligible applicant through (or lock everyone out).
 */
export async function getAgeRule(): Promise<AgeRule> {
  const admin = createAdminClient();
  const { data: cycle } = await admin
    .from("cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  let programStart = DEFAULT_PROGRAM_START_DATE;
  let maxAge = DEFAULT_MAX_ENROLLMENT_AGE;

  if (cycle) {
    const { data: rows } = await admin
      .from("cycle_settings")
      .select("key, value")
      .eq("cycle_id", cycle.id)
      .in("key", ["program_start_date", "max_enrollment_age"]);
    for (const row of rows ?? []) {
      if (
        row.key === "program_start_date" &&
        typeof row.value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.value)
      ) {
        programStart = row.value;
      }
      if (row.key === "max_enrollment_age" && Number.isInteger(row.value)) {
        maxAge = row.value as number;
      }
    }
  }
  return { programStart, maxAge };
}

/** True when `dob` makes the applicant too old to enroll. */
export async function isTooOldToEnroll(dob: string): Promise<{
  tooOld: boolean;
  maxAge: number;
}> {
  const rule = await getAgeRule();
  return {
    tooOld: exceedsMaxAge(dob, rule.programStart, rule.maxAge),
    maxAge: rule.maxAge,
  };
}
