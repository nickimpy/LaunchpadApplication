import Link from "next/link";
import { STEPS } from "@/utils/steps";

// Dashboard charts, rendered on the server as plain HTML — no chart library,
// nothing to load, works with JavaScript off.
//
// Both are SINGLE-series magnitude views, so they use one hue (brand teal-dark,
// #0a8196 — 4.6:1 on white, well over the 3:1 a non-text mark needs) and no
// legend: the heading names the series. Values are printed in text ink beside
// each bar, so nothing depends on reading a bar's length or its colour. Every
// bar is a link to exactly the applicants it counts, and carries a `title`
// tooltip plus an aria-label that reads the full sentence.

const BAR_HEIGHT = "h-3"; // 12px: a thin mark, per the chart spec
const TRACK = "bg-grey-tint3";
const FILL = "bg-teal-dark";

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * Horizontal bar per step: how many applicants have COMPLETED it, out of
 * everyone in the cycle. Steps 2–6 run in parallel, so this is "how far along
 * is the cohort on each piece" rather than a strict funnel.
 */
export function StepCompletionBars({
  total,
  completed,
}: {
  total: number;
  completed: Record<number, number>;
}) {
  return (
    <section aria-labelledby="progress-chart-heading" className="mb-9">
      <h2 id="progress-chart-heading" className="mb-1 text-lg font-bold">
        Where applicants are
      </h2>
      <p className="mb-3 text-xs">
        Applicants who have completed each step, out of {total} in this cycle.
        Steps 2–6 can be done in any order. Select a bar to see who.
      </p>
      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        {total === 0 ? (
          <p className="text-xs">No applicants yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {STEPS.map((step) => {
              const n = completed[step.number] ?? 0;
              const share = pct(n, total);
              const sentence = `Step ${step.number}, ${step.name}: ${n} of ${total} applicants complete (${share}%)`;
              return (
                <li key={step.number}>
                  <Link
                    href={`/admin/applicants?step=${step.number}&status=complete`}
                    title={sentence}
                    aria-label={`${sentence} — view list`}
                    className="group grid grid-cols-1 items-center gap-1 rounded-md focus:outline-none
                      focus-visible:ring-2 focus-visible:ring-teal-dark sm:grid-cols-[14rem_1fr_6rem] sm:gap-3"
                  >
                    <span className="text-base group-hover:underline">
                      <span className="font-bold">{step.number}.</span> {step.name}
                    </span>
                    <span className={`block w-full overflow-hidden rounded-full ${TRACK} ${BAR_HEIGHT}`}>
                      <span
                        className={`block ${BAR_HEIGHT} rounded-full ${FILL}`}
                        // A sliver for 1+ so a small non-zero count is still visible.
                        style={{ width: n > 0 ? `max(${share}%, 6px)` : "0" }}
                      />
                    </span>
                    <span className="text-xs sm:text-right">
                      <span className="font-bold">{n}</span> ({share}%)
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export type SchoolCount = {
  /** Display name ("Other" free text is grouped by what the student typed). */
  name: string;
  count: number;
  /** Where the row links: a school filter for listed schools, a search otherwise. */
  href: string | null;
  isPartner: boolean;
};

/** Schools ranked by number of applicants, with an inline bar for scale. */
export function SchoolTable({
  rows,
  total,
}: {
  rows: SchoolCount[];
  total: number;
}) {
  const max = rows[0]?.count ?? 0;
  return (
    <section aria-labelledby="schools-heading" className="mb-9">
      <h2 id="schools-heading" className="mb-1 text-lg font-bold">
        Applicants by school
      </h2>
      <p className="mb-3 text-xs">
        Ranked by number of applicants. Select a school to see its applicants.
      </p>
      <div className="overflow-x-auto rounded-lg border border-grey-tint2 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-6 text-xs">No applicants yet.</p>
        ) : (
          <table className="w-full min-w-[480px] border-collapse text-base">
            <caption className="sr-only">
              Number of applicants per school, highest first
            </caption>
            <thead>
              <tr className="border-b border-grey-tint2 text-left">
                <th scope="col" className="w-12 px-3 py-3">#</th>
                <th scope="col" className="px-3 py-3">School</th>
                <th scope="col" className="px-3 py-3 text-right">Applicants</th>
                <th scope="col" className="w-1/3 px-3 py-3">
                  <span className="sr-only">Share of applicants</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.name} className="border-b border-grey-tint3 last:border-0">
                  <td className="px-3 py-3 text-xs">{i + 1}</td>
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    {row.href ? (
                      <Link className="font-bold text-teal-dark underline" href={row.href}>
                        {row.name}
                      </Link>
                    ) : (
                      <span className="font-bold">{row.name}</span>
                    )}
                    {row.isPartner && (
                      <span className="block text-xs text-green-dark">Partner school</span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-right">
                    <span className="font-bold">{row.count}</span>{" "}
                    <span className="text-xs">({pct(row.count, total)}%)</span>
                  </td>
                  <td className="px-3 py-3" aria-hidden="true">
                    <span className={`block w-full overflow-hidden rounded-full ${TRACK} ${BAR_HEIGHT}`}>
                      <span
                        className={`block ${BAR_HEIGHT} rounded-full ${FILL}`}
                        style={{ width: `max(${pct(row.count, max)}%, 6px)` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
