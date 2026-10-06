// Age helpers shared by the client forms and the server actions, so this file
// stays free of `server-only`. Dates are YYYY-MM-DD strings compared as plain
// calendar dates — no timezone maths, so a birthday never shifts by a day.

function parts(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Whole years between `dob` and `on` (both YYYY-MM-DD), or null if unparseable. */
export function ageOn(dob: string, on: string): number | null {
  const d = parts(dob);
  const t = parts(on);
  if (!d || !t) return null;
  let age = t[0] - d[0];
  if (t[1] < d[1] || (t[1] === d[1] && t[2] < d[2])) age -= 1;
  return age;
}

/** Today as YYYY-MM-DD in the server/browser's local calendar. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 18 or older today — old enough to authorize the release of their own records. */
export function isAdult(dob: string, today: string = todayIso()): boolean {
  const age = ageOn(dob, today);
  return age !== null && age >= 18;
}

/**
 * True when the applicant will be older than `maxAge` on `referenceDate` (the
 * program start). Launchpad measures eligibility at enrollment, not at signup,
 * so someone who is 22 today but turns 23 before July is not eligible.
 */
export function exceedsMaxAge(
  dob: string,
  referenceDate: string,
  maxAge: number,
): boolean {
  const age = ageOn(dob, referenceDate);
  return age !== null && age > maxAge;
}

// Fallbacks for the two cycle settings that drive the age rule. The live values
// are admin-editable cycle_settings (program_start_date, max_enrollment_age).
export const DEFAULT_PROGRAM_START_DATE = "2027-07-06";
export const DEFAULT_MAX_ENROLLMENT_AGE = 22;
