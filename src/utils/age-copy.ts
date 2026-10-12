// The "too old to enroll" message. Shared by the signup notice (rich, with
// links) and the profile form (plain text in a field error), so the two never
// drift apart. We know the applicant's age at program start, so they only see
// the line that applies to them: LiftOff for the two years just past the
// limit (23–24 today), general training resources for anyone older.

export const LIFTOFF_URL = "https://www.launchpadphilly.org/careers";
export const GENERAL_INFO_EMAIL = "info@launchpadphilly.org";

/** How many years past the limit still fit LiftOff (23 and 24 when max is 22). */
const LIFTOFF_EXTRA_YEARS = 2;

/** True when this age at program start should be pointed to LiftOff. */
export function liftoffEligible(ageAtStart: number, maxAge: number): boolean {
  return ageAtStart > maxAge && ageAtStart <= maxAge + LIFTOFF_EXTRA_YEARS;
}

export function ageIneligibleText(maxAge: number, ageAtStart: number): string {
  const first = `Launchpad 101 is only eligible for learners ${maxAge} or younger upon enrollment.`;
  return liftoffEligible(ageAtStart, maxAge)
    ? `${first} Consider applying for LiftOff at www.launchpadphilly.org/careers.`
    : `${first} If you're seeking training resources, reach out to ${GENERAL_INFO_EMAIL}.`;
}
