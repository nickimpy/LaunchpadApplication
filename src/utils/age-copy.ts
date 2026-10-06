// The "too old to enroll" message, in the exact wording Launchpad approved.
// Shared by the signup notice (rich, with links) and the profile form (plain
// text in a field error), so the two never drift apart.

export const LIFTOFF_URL = "https://www.launchpadphilly.org/careers";
export const GENERAL_INFO_EMAIL = "info@launchpadphilly.org";

export function ageIneligibleText(maxAge: number): string {
  return (
    `Launchpad 101 is only eligible for learners ${maxAge} or younger upon enrollment. ` +
    `If you are ${maxAge + 1} or ${maxAge + 2} and interested in training, consider applying for LiftOff at ` +
    `www.launchpadphilly.org/careers. If you are older than ${maxAge + 2} and seeking training resources, ` +
    `reach out to ${GENERAL_INFO_EMAIL}.`
  );
}
