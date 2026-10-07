import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser } from "@/utils/admin";
import { STEPS, ADMIN_STATUS_LABELS, adminStatusLabel, type StepStatus } from "@/utils/steps";

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

  const [{ count: applicantCount }, { data: progress }] = await Promise.all([
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("cycle_id", cycleId),
    supabase
      .from("step_progress")
      .select("step_number, status, applications!inner(cycle_id)")
      .eq("applications.cycle_id", cycleId),
  ]);

  const byStep = new Map<number, Counts>();
  for (const row of progress ?? []) {
    const n = row.step_number as number;
    const counts = byStep.get(n) ?? { ...EMPTY };
    counts[row.status as StepStatus] += 1;
    byStep.set(n, counts);
  }

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">
        Welcome back, {admin?.firstName || "there"}
      </h1>
      <p className="mb-9">
        {applicantCount ?? 0} applicant{applicantCount === 1 ? "" : "s"} in the
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
    </>
  );
}
