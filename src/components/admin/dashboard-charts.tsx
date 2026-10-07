import Link from "next/link";
import { STEPS, STAGE_DONE, stageLabel } from "@/utils/steps";

// "Where applicants are", rendered on the server as plain HTML — no chart
// library, works with JavaScript off.
//
// Single-series magnitude view, so one hue (brand teal-dark, #0a8196 — 4.6:1 on
// white, over the 3:1 a non-text mark needs) and no legend: the heading names
// the series. Counts are printed in text ink beside each bar, so nothing depends
// on reading a bar's length or colour. Each bar links to exactly the applicants
// it counts, with a `title` tooltip and an aria-label reading the full sentence.

const BAR_HEIGHT = "h-3"; // 12px: a thin mark, per the chart spec

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/**
 * One bar per stage: how many applicants are CURRENTLY on each step, meaning
 * it's the earliest step they haven't completed (see currentStage). Every
 * applicant is counted once, so the tallest bar is the bottleneck, and the
 * cohort drains downward as steps finish until everyone reaches the decision.
 */
export function StageBars({
  total,
  byStage,
}: {
  total: number;
  byStage: Record<number, number>;
}) {
  const stages = [...STEPS.map((s) => s.number), STAGE_DONE];
  const max = Math.max(0, ...stages.map((n) => byStage[n] ?? 0));
  return (
    <section aria-labelledby="stage-chart-heading" className="mb-9">
      <h2 id="stage-chart-heading" className="mb-1 text-lg font-bold">
        Where applicants are
      </h2>
      <p className="mb-3 text-xs">
        Each applicant is counted once, on the earliest step they haven&apos;t
        completed — so the longest bar is the current bottleneck. Select a bar to
        see who.
      </p>
      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        {total === 0 ? (
          <p className="text-xs">No applicants yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stages.map((stage) => {
              const n = byStage[stage] ?? 0;
              const label = stageLabel(stage);
              const sentence = `${n} of ${total} applicants ${
                stage === STAGE_DONE ? "have a released decision" : `are on step ${label}`
              } (${pct(n, total)}%)`;
              const bar = (
                <span className="block w-full overflow-hidden rounded-full bg-grey-tint3">
                  <span
                    className={`block ${BAR_HEIGHT} rounded-full ${
                      stage === STAGE_DONE ? "bg-green-dark" : "bg-teal-dark"
                    }`}
                    // Scaled to the largest stage so small groups stay readable;
                    // a sliver for 1+ keeps a non-zero count visible.
                    style={{ width: n > 0 ? `max(${pct(n, max)}%, 6px)` : "0" }}
                  />
                </span>
              );
              const row = (
                <>
                  <span className="text-base">{label}</span>
                  {bar}
                  <span className="text-xs sm:text-right">
                    <span className="font-bold">{n}</span> ({pct(n, total)}%)
                  </span>
                </>
              );
              const grid =
                "grid grid-cols-1 items-center gap-1 rounded-md sm:grid-cols-[16rem_1fr_6rem] sm:gap-3";
              return (
                <li key={stage}>
                  {n > 0 ? (
                    <Link
                      href={`/admin/applicants?stage=${stage}`}
                      title={sentence}
                      aria-label={`${sentence} — view list`}
                      className={`${grid} hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark`}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className={grid} title={sentence}>
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
