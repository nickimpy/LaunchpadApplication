import type { Metadata } from "next";
import Link from "next/link";
import {
  getApplicants,
  parseFilters,
  hasActiveFilters,
  SORT_OPTIONS,
} from "@/utils/applicants";
import { STEPS, STATUS_LABELS, type StepStatus } from "@/utils/steps";
import { ApplicantTable } from "@/components/admin/applicant-table";

export const metadata: Metadata = { title: "Applicants — Launchpad Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parseFilters(await searchParams);
  const { rows, schools, total } = await getApplicants(filters);

  const exportHref = `/admin/applicants/export?${new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  )}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Applicants</h1>
          <p className="mt-1 text-xs">
            Showing {rows.length} of {total}
            {rows.length > 0 && " · tick a row, or shift-click to select a range"}
            {hasActiveFilters(filters) && (
              <>
                {" · "}
                <Link className="text-teal-dark underline" href="/admin/applicants">
                  Clear filters
                </Link>
              </>
            )}
          </p>
        </div>
        <a
          href={exportHref}
          className="rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base
            font-bold text-teal-dark hover:bg-grey-tint4 focus:outline-none
            focus-visible:ring-2 focus-visible:ring-teal-dark"
        >
          Export CSV
        </a>
      </div>

      {/* GET form: filters live in the URL, so a filtered view is shareable
          and the CSV export can reuse exactly the same query string. */}
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="block">
          <span className="block text-xs font-bold">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Name, email, or school"
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-bold">School</span>
          <select
            name="school"
            defaultValue={filters.schoolId}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold">Program</span>
          <select
            name="program"
            defaultValue={filters.program}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            <option value="">Any program</option>
            <option value="lightspeed">Lightspeed</option>
            <option value="foundations">Foundations</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold">Interview track</span>
          <select
            name="track"
            defaultValue={filters.track}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            <option value="">Any track</option>
            <option value="A">Track A (partner school)</option>
            <option value="B">Track B (at Launchpad)</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold">Step</span>
          <select
            name="step"
            defaultValue={filters.step}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            <option value="">Any step</option>
            {STEPS.map((s) => (
              <option key={s.number} value={String(s.number)}>
                {s.number}. {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold">…with status</span>
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            <option value="">Any status</option>
            {(Object.keys(STATUS_LABELS) as StepStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-bold">Sort by</span>
          <select
            name="sort"
            defaultValue={filters.sort}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-md bg-teal-dark px-3 py-3 text-base font-bold text-white
              hover:brightness-110 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark focus-visible:ring-offset-2 sm:w-auto sm:min-w-44"
          >
            Apply filters
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">No applicants match</h2>
          <p>
            {total === 0
              ? "No one has started an application in this cycle yet."
              : "Try widening or clearing your filters."}
          </p>
        </div>
      ) : (
        <ApplicantTable rows={rows} />
      )}
    </>
  );
}
