import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser } from "@/utils/admin";
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
  const supabase = createClient(await cookies());

  // Scoped to the active cycle, same as the applicant list — otherwise these
  // counts include past cycles and disagree with the list they link to.
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  const cycleId = cycle?.id ?? "";

  const [{ data: applications }, { data: progress }] = await Promise.all([
    supabase
      .from("applications")
      .select("school_id, school_other, schools ( name, is_partner )")
      .eq("cycle_id", cycleId),
    supabase
      .from("step_progress")
      .select("application_id, step_number, status, applications!inner(cycle_id)")
      .eq("applications.cycle_id", cycleId),
  ]);

  const byStep = new Map<number, Counts>();
  for (const row of progress ?? []) {
    const n = row.step_number as number;
    const counts = byStep.get(n) ?? { ...EMPTY };
    counts[row.status as StepStatus] += 1;
    byStep.set(n, counts);
  }

  const applicantCount = applications?.length ?? 0;
  // Each applicant's current stage = earliest step they haven't completed.
  const statusesByApp = new Map<string, Record<number, StepStatus>>();
  for (const row of progress ?? []) {
    const id = row.application_id as string;
    const statuses = statusesByApp.get(id) ?? {};
    statuses[row.step_number as number] = row.status as StepStatus;
    statusesByApp.set(id, statuses);
  }
  const byStage: Record<number, number> = {};
  for (const statuses of statusesByApp.values()) {
    const stage = currentStage(statuses);
    byStage[stage] = (byStage[stage] ?? 0) + 1;
  }

  // Applicants per school. Listed schools group by id (names can repeat across
  // renames, ids can't) and link to the school filter; "Other" free text groups
  // by what the student typed and links to a name search instead.
  type AppRow = {
    school_id: string | null;
    school_other: string | null;
    schools: { name: string | null; is_partner: boolean | null } | null;
  };
  const bySchool = new Map<string, SchoolCount>();
  for (const a of (applications ?? []) as unknown as AppRow[]) {
    let key: string;
    let entry: SchoolCount;
    if (a.school_id && a.schools?.name) {
      key = `id:${a.school_id}`;
      entry = {
        name: a.schools.name,
        count: 0,
        href: `/admin/applicants?school=${a.school_id}`,
        isPartner: Boolean(a.schools.is_partner),
      };
    } else if (a.school_other?.trim()) {
      const name = a.school_other.trim();
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
      <p className="mb-9">
        {applicantCount} applicant{applicantCount === 1 ? "" : "s"} in the
        current cycle.{" "}
        <Link className="text-teal-dark underline" href="/admin/applicants">
          View the applicant list
        </Link>
        .
      </p>

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
                        <span className="text-grey-tint1">—</span>
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
        <StageBars total={statusesByApp.size} byStage={byStage} />
        <SchoolTable rows={schoolRows} />
      </div>
    </>
  );
}
