import type { Metadata } from "next";
import Link from "next/link";
import { getApplicants, parseFilters } from "@/utils/applicants";
import { DuplicateGroup } from "@/components/admin/duplicate-group";

export const metadata: Metadata = { title: "Possible duplicates — Launchpad Admin" };

/**
 * Records that look like the same person (same date of birth + same name or
 * phone). Usually a student who didn't verify their first email and signed up
 * again with another one. Keeping one archives the rest — nothing is deleted.
 */
export default async function DuplicatesPage() {
  const { duplicateGroups } = await getApplicants(parseFilters({ view: "all" }));

  return (
    <>
      <p className="mb-3 text-xs">
        <Link className="text-teal-dark underline" href="/admin">
          ← Dashboard
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-bold">Possible duplicates</h1>
      <p className="mb-9 text-xs">
        Same date of birth and the same name or phone number — almost always one
        student who signed up twice (often after not verifying their first
        email). Keep the record they actually use; the others are archived as
        duplicates, not deleted, and can be restored from the applicant list.
      </p>
      {duplicateGroups.length === 0 ? (
        <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <p>No possible duplicates right now.</p>
        </div>
      ) : (
        duplicateGroups.map((g) => (
          <DuplicateGroup
            key={g.map((r) => r.applicationId).join("|")}
            cards={g.map((r) => ({
              applicationId: r.applicationId,
              name: `${r.firstName} ${r.lastName}`,
              email: r.email,
              phone: r.phone,
              dateOfBirth: r.dateOfBirth,
              schoolName: r.schoolName,
              verified: r.verified,
              lastSignIn: r.lastSignIn,
              createdAt: r.createdAt,
              completedCount: r.completedCount,
            }))}
          />
        ))
      )}
    </>
  );
}
