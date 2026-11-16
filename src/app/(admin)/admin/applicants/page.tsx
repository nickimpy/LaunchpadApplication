import type { Metadata } from "next";
import Link from "next/link";
import {
  getApplicants,
  parseFilters,
  hasActiveFilters,
  applicantsQuery,
  sortLinks,
  SORT_OPTIONS,
} from "@/utils/applicants";
import {
  STEPS,
  STAGE_DONE,
  ADMIN_STATUS_LABELS,
  stageLabel,
  type StepStatus,
} from "@/utils/steps";
import { ApplicantTable } from "@/components/admin/applicant-table";

export const metadata: Metadata = { title: "Applicants — Launchpad Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = parseFilters(await searchParams);
  const { rows, schools, total, counts } = await getApplicants(filters);
  const viewTabs = [
    { value: "", label: "Active", count: counts.active },
    { value: "unverified", label: "Unverified signups", count: counts.unverified },
    { value: "archived", label: "Archived", count: counts.archived },
  ];

  // Same parameter names the list itself reads (the old version serialised the
  // filter object's own keys, so ?schoolId= was silently ignored by the export).
  const exportHref = `/admin/applicants/export?${applicantsQuery(filters)}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Applicants</h1>
          <p className="mt-1 text-xs">
            Showing {rows.length}
            {filters.view === "" ? ` of ${total} active` : ""}
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

      {/* Which records: the active pipeline by default. Unverified signups
          (never confirmed their email) and archived records live in their own
          tabs so they don't inflate counts or clutter the working list. */}
      <nav aria-label="Applicant views" className="mb-3 flex flex-wrap gap-3">
        {viewTabs.map((t) => {
          const active = filters.view === t.value;
          return (
            <Link
              key={t.label}
              href={`/admin/applicants?${applicantsQuery({ ...filters, view: t.value, stage: "", step: "", status: "" })}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark ${
                active ? "bg-teal-dark text-white" : "border border-grey-tint1 bg-white text-teal-dark hover:bg-grey-tint4"
              }`}
            >
              {t.label} ({t.count})
            </Link>
          );
        })}
        {counts.duplicateGroups > 0 && (
          <Link
            href="/admin/duplicates"
            className="rounded-full bg-orange-tint3 px-3 py-1 text-xs font-bold text-orange-dark hover:underline"
          >
            {counts.duplicateGroups} possible {counts.duplicateGroups === 1 ? "duplicate" : "duplicates"} to review →
          </Link>
        )}
      </nav>

      {/* GET form: filters live in the URL, so a filtered view is shareable
          and the CSV export can reuse exactly the same query string. */}
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3"
      >
        <input type="hidden" name="view" value={filters.view} />
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
          <span className="block text-xs font-bold">Currently on</span>
          <select
            name="stage"
            defaultValue={filters.stage}
            className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
          >
            <option value="">Any step</option>
            {[...STEPS.map((s) => s.number), STAGE_DONE].map((n) => (
              <option key={n} value={String(n)}>
                {stageLabel(n)}
              </option>
            ))}
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
            {(Object.keys(ADMIN_STATUS_LABELS) as StepStatus[]).map((s) => (
              <option key={s} value={s}>
                {ADMIN_STATUS_LABELS[s]}
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
        <ApplicantTable rows={rows} sort={sortLinks(filters)} />
      )}
    </>
  );
}
