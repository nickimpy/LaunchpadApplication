// Duplicate detection: pure functions, no database — easy to reason about and
// reuse (admin list badges, the Possible duplicates screen, signup warning).
//
// The rule (checked against real data 2026-11-16, zero false matches): same
// date of birth AND (same name OR same phone number). Name alone is too loose
// (two students can share a name); DOB + name or DOB + phone is one person.

export type DupCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phone: string | null;
};

export const normName = (first: string, last: string) =>
  `${first} ${last}`.toLowerCase().replace(/[^a-z]/g, "");

/** Last 10 digits, so "+1 (215) 555-1234" and "215.555.1234" match. */
export const normPhone = (phone: string | null) =>
  (phone ?? "").replace(/\D/g, "").slice(-10);

export function isSamePerson(a: DupCandidate, b: DupCandidate): boolean {
  if (!a.dateOfBirth || a.dateOfBirth !== b.dateOfBirth) return false;
  const sameName = normName(a.firstName, a.lastName) === normName(b.firstName, b.lastName);
  const pa = normPhone(a.phone);
  const samePhone = pa.length === 10 && pa === normPhone(b.phone);
  return sameName || samePhone;
}

/** Stable key for a pair, matching duplicate_dismissals (smaller id first). */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Groups of 2+ records that look like the same person, skipping pairs staff
 * marked "not a duplicate". Connected groups: if A~B and B~C, all three are
 * shown together even if A and C only match through B.
 */
export function findDuplicateGroups<T extends DupCandidate>(
  people: T[],
  dismissed: Set<string>,
): T[][] {
  const parent = new Map(people.map((p) => [p.id, p.id]));
  const find = (x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      if (dismissed.has(pairKey(a.id, b.id))) continue;
      if (isSamePerson(a, b)) parent.set(find(a.id), find(b.id));
    }
  }
  const groups = new Map<string, T[]>();
  for (const p of people) {
    const root = find(p.id);
    groups.set(root, [...(groups.get(root) ?? []), p]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
