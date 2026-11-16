import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUser } from "@/utils/admin";
import { getApplicants, parseFilters } from "@/utils/applicants";
import {
  STEPS,
  ADMIN_STATUS_LABELS,
  adminStatusLabel,
  currentStage,
  type StepStatus,
} from "@/utils/steps";
import { StageBars } from "@/components/admin/dashboard-charts";
import { SchoolTable, type SchoolCount } from "@/components/admin/school-table";

export const metadata: Metadata = { title: "Dashboard — Launchpad Admin" };

type Counts = Record<StepStatus, number>;

const EMPTY: Counts = {
  not_started: 0,
  in_progress: 0,
  submitted: 0,
  pending_verification: 0,
  needs_attention: 0,
  complete: 0,
};

/**
 * Pipeline funnel: how many applicants sit at each status, per step. Gives
 * staff the "counts by step, completed vs outstanding" view the PRD asks for.
 * Every count links to the applicant list filtered to exactly those students,
 * so a number on this page is never a dead end.
 */
export default async function AdminDashboard() {
  const admin = await getAdminUser();

  // Same source as the applicant list, so every number here matches the list
  // it links to. Only the ACTIVE pipeline counts: verified email, not archived.
  // Unverified signups and archived records would otherwise inflate every bar.
  const { rows, counts } = await getApplicants(parseFilters({}));

  const byStep = new Map<number, Counts>();
  const byStage: Record<number, number> = {};
  for (const r of rows) {
    for (const step of STEPS) {
      const st = r.statuses[step.number] ?? "not_started";
      const c = byStep.get(step.number) ?? { ...EMPTY };
      c[st] += 1;
      byStep.set(step.number, c);
    }
    const stage = currentStage(r.statuses);
    byStage[stage] = (byStage[stage] ?? 0) + 1;
  }
  const applicantCount = counts.active;

  // Applicants per school. Listed schools group by id (names can repeat across
  // renames, ids can't) and link to the school filter; "Other" free text groups
  // by what the student typed and links to a name search instead.
  const bySchool = new Map<string, SchoolCount>();
  for (const r of rows) {
    let key: string;
    let entry: SchoolCount;
    if (r.schoolId && r.schoolName) {
      key = `id:${r.schoolId}`;
      entry = {
        name: r.schoolName,
        count: 0,
        href: `/admin/applicants?school=${r.schoolId}`,
        isPartner: r.isPartnerSchool,
      };
    } else if (r.schoolName.trim()) {
      const name = r.schoolName.trim();
      key = `other:${name.toLowerCase()}`;
      entry = {
        name: `${name} (typed in)`,
        count: 0,
        href: `/admin/applicants?q=${encodeURIComponent(name)}`,
        isPartner: false,
      };
    } else {
      key = "none";
      entry = { name: "No school entered yet", count: 0, href: null, isPartner: false };
    }
    const current = bySchool.get(key) ?? entry;
    current.count += 1;
    bySchool.set(key, current);
  }
  const schoolRows = [...bySchool.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">
        Welcome back, {admin?.firstName || "there"}
      </h1>
      <p className="mb-3">
        {applicantCount} active applicant{applicantCount === 1 ? "" : "s"} in the
        current cycle.{" "}
        <Link className="text-teal-dark underline" href="/admin/applicants">
          View the applicant list
        </Link>
        .
      </p>
      <p className="mb-6 text-xs">
        Not counted:{" "}
        <Link className="text-teal-dark underline" href="/admin/applicants?view=unverified">
          {counts.unverified} unverified signup{counts.unverified === 1 ? "" : "s"}
        </Link>{" "}
        (never confirmed their email — auto-archived after 30 days) and{" "}
        <Link className="text-teal-dark underline" href="/admin/applicants?view=archived">
          {counts.archived} archived
        </Link>
        .
      </p>
      {counts.duplicateGroups > 0 && (
        <div className="mb-9 rounded-md border-l-4 border-orange-dark bg-orange-tint3 px-3 py-3">
          <strong>
            {counts.duplicateGroups} possible duplicate{counts.duplicateGroups === 1 ? "" : "s"}
          </strong>{" "}
          — students who appear to have signed up more than once.{" "}
          <Link className="font-bold text-teal-dark underline" href="/admin/duplicates">
            Review and keep one
          </Link>
        </div>
      )}

      <h2 className="mb-1 text-lg font-bold">Pipeline</h2>
      <p className="mb-3 text-xs">
        Select any number to see exactly which applicants it counts.
      </p>
      <div className="overflow-x-auto rounded-lg border border-grey-tint2 bg-white shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-base">
          <caption className="sr-only">
            Applicant counts by step and status
          </caption>
          <thead>
            <tr className="border-b border-grey-tint2 text-left">
              <th scope="col" className="px-3 py-3">Step</th>
              {(Object.keys(EMPTY) as StepStatus[]).map((status) => (
                <th scope="col" key={status} className="px-3 py-3">
                  {ADMIN_STATUS_LABELS[status]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STEPS.map((step) => {
              const counts = byStep.get(step.number) ?? EMPTY;
              return (
                <tr key={step.number} className="border-b border-grey-tint3 last:border-0">
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    <span className="font-bold">{step.number}.</span> {step.name}
                  </th>
                  {(Object.keys(EMPTY) as StepStatus[]).map((status) => (
                    <td key={status} className="px-3 py-3">
                      {counts[status] ? (
                        <Link
                          href={`/admin/applicants?step=${step.number}&status=${status}`}
                          className="font-bold text-teal-dark underline focus:outline-none
                            focus-visible:ring-2 focus-visible:ring-teal-dark"
                          aria-label={`${counts[status]} ${
                            counts[status] === 1 ? "applicant" : "applicants"
                          } at Step ${step.number} (${step.name}): ${adminStatusLabel(step.number, status)} — view list`}
                        >
                          {counts[status]}
                        </Link>
                      ) : (
                        <span className="text-grey">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-9">
        <StageBars total={rows.length} byStage={byStage} />
        <SchoolTable rows={schoolRows} />
      </div>
    </>
  );
}
