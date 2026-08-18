import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser } from "@/utils/admin";
import { STEPS, STATUS_LABELS, type StepStatus } from "@/utils/steps";

export const metadata: Metadata = { title: "Dashboard — Launchpad Admin" };

type Counts = Record<StepStatus, number>;

const EMPTY: Counts = {
  not_started: 0,
  in_progress: 0,
  submitted: 0,
  pending_verification: 0,
  complete: 0,
};

/**
 * Pipeline funnel: how many applicants sit at each status, per step. Gives
 * staff the "counts by step, completed vs outstanding" view the PRD asks for.
 */
export default async function AdminDashboard() {
  const admin = await getAdminUser();
  const supabase = createClient(await cookies());

  const [{ count: applicantCount }, { data: progress }] = await Promise.all([
    supabase.from("applications").select("*", { count: "exact", head: true }),
    supabase.from("step_progress").select("step_number, status"),
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

      <h2 className="mb-3 text-lg font-bold">Pipeline</h2>
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
                  {STATUS_LABELS[status]}
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
                      {counts[status] || <span className="text-grey-tint1">—</span>}
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
