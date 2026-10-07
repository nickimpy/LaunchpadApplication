import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { currentStage, type StepStatus } from "@/utils/steps";

export type ApplicantFilters = {
  q: string;
  schoolId: string;
  /** Earliest incomplete step (1–7), or 8 for all done — see currentStage(). */
  stage: string;
  step: string;
  status: string;
  sort: string;
};

export type ApplicantRow = {
  applicationId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  phone: string | null;
  schoolName: string;
  isPartnerSchool: boolean;
  graduationYear: string | null;
  program: string | null;
  collegeWarning: boolean;
  /** Flag raised but staff have since talked it through and cleared it. */
  collegeWarningResolved: boolean;
  statuses: Record<number, StepStatus>;
  completedCount: number;
  createdAt: string;
};

export const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "progress", label: "Most steps done first" },
  { value: "progress_asc", label: "Fewest steps done first" },
  { value: "stage", label: "Furthest behind first" },
  { value: "stage_desc", label: "Furthest along first" },
  { value: "school", label: "School (A–Z)" },
  { value: "school_desc", label: "School (Z–A)" },
  { value: "grad", label: "Graduation year (earliest first)" },
  { value: "grad_desc", label: "Graduation year (latest first)" },
] as const;

/** Sortable table columns → their ascending sort key (descending = `_desc`). */
export const SORTABLE_COLUMNS = {
  name: "name",
  school: "school",
  grad: "grad",
  stage: "stage",
  progress: "progress_asc",
} as const;
export type SortableColumn = keyof typeof SORTABLE_COLUMNS;

/**
 * The applicant-list URL for a set of filters, optionally overriding some.
 * One place builds these so column-header sort links, the CSV export and the
 * dashboard all agree on parameter names.
 */
export function applicantsQuery(
  f: ApplicantFilters,
  overrides: Partial<ApplicantFilters> = {},
): string {
  const merged = { ...f, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.schoolId) params.set("school", merged.schoolId);
  if (merged.stage) params.set("stage", merged.stage);
  if (merged.step) params.set("step", merged.step);
  if (merged.status) params.set("status", merged.status);
  if (merged.sort && merged.sort !== "name") params.set("sort", merged.sort);
  return params.toString();
}

/**
 * For each sortable column: where clicking its header goes, and whether the
 * list is currently sorted by it (for aria-sort and the arrow). Clicking the
 * active column flips the direction; any other column starts ascending.
 */
export function sortLinks(
  f: ApplicantFilters,
): Record<SortableColumn, { href: string; direction: "ascending" | "descending" | null }> {
  const out = {} as Record<
    SortableColumn,
    { href: string; direction: "ascending" | "descending" | null }
  >;
  for (const [col, asc] of Object.entries(SORTABLE_COLUMNS) as [SortableColumn, string][]) {
    // "progress" is a special case: its ascending key carries the suffix.
    const desc = asc === "progress_asc" ? "progress" : `${asc}_desc`;
    const direction =
      f.sort === asc ? "ascending" : f.sort === desc ? "descending" : null;
    const next = direction === "ascending" ? desc : asc;
    out[col] = {
      href: `/admin/applicants?${applicantsQuery(f, { sort: next })}`,
      direction,
    };
  }
  return out;
}

/** Parses raw searchParams into a normalized, trusted filter object. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ApplicantFilters {
  const one = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  return {
    q: one("q"),
    schoolId: one("school"),
    stage: one("stage"),
    step: one("step"),
    status: one("status"),
    sort: one("sort") || "name",
  };
}

/** True when any filter is narrowing the list (drives the "clear" button). */
export function hasActiveFilters(f: ApplicantFilters): boolean {
  return Boolean(f.q || f.schoolId || f.stage || (f.step && f.status));
}

/**
 * Every applicant in the active cycle, with their per-step statuses, filtered
 * and sorted for the admin table.
 *
 * Filtering happens in memory rather than in SQL: an admissions cycle is ~200
 * applicants (PRD), so the whole set fits comfortably in one round trip, and
 * step-status filtering ("show me everyone whose Step 2 is outstanding") would
 * otherwise need an awkward correlated subquery. Revisit if a cycle ever grows
 * by an order of magnitude.
 */
export async function getApplicants(filters: ApplicantFilters): Promise<{
  rows: ApplicantRow[];
  schools: { id: string; name: string }[];
  total: number;
}> {
  const supabase = createClient(await cookies());

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const [{ data: applications }, { data: schools }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        `id, student_id, school_id, school_other, graduation_year, program,
         college_warning_flagged, college_warning_resolved_at, created_at,
         students ( first_name, last_name, preferred_name, email, phone ),
         step_progress ( step_number, status ),
         schools ( name, is_partner )`,
      )
      .eq("cycle_id", cycle?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase.from("schools").select("id, name").eq("is_active", true).order("name"),
  ]);

  type Joined = {
    id: string;
    student_id: string;
    school_id: string | null;
    school_other: string | null;
    graduation_year: string | null;
    program: string | null;
    college_warning_flagged: boolean;
    college_warning_resolved_at: string | null;
    created_at: string;
    students: {
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      email: string | null;
      phone: string | null;
    } | null;
    step_progress: { step_number: number; status: StepStatus }[] | null;
    schools: { name: string | null; is_partner: boolean | null } | null;
  };

  const all: ApplicantRow[] = ((applications ?? []) as unknown as Joined[]).map((a) => {
    const statuses: Record<number, StepStatus> = {};
    for (const sp of a.step_progress ?? []) statuses[sp.step_number] = sp.status;
    return {
      applicationId: a.id,
      studentId: a.student_id,
      firstName: a.students?.first_name ?? "",
      lastName: a.students?.last_name ?? "",
      preferredName: a.students?.preferred_name ?? null,
      email: a.students?.email ?? "",
      phone: a.students?.phone ?? null,
      // "Other" schools have no row to join, so fall back to the free text.
      schoolName: a.schools?.name ?? a.school_other ?? "",
      isPartnerSchool: Boolean(a.schools?.is_partner),
      graduationYear: a.graduation_year,
      program: a.program,
      collegeWarning: a.college_warning_flagged,
      collegeWarningResolved: Boolean(a.college_warning_resolved_at),
      statuses,
      completedCount: Object.values(statuses).filter((s) => s === "complete").length,
      createdAt: a.created_at,
    };
  });

  const q = filters.q.toLowerCase();
  const rows = all.filter((r) => {
    if (q) {
      const haystack = [r.firstName, r.lastName, r.preferredName, r.email, r.schoolName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.stage && currentStage(r.statuses) !== Number(filters.stage)) {
      return false;
    }
    if (filters.step && filters.status) {
      const step = Number(filters.step);
      if ((r.statuses[step] ?? "not_started") !== filters.status) return false;
    }
    return true;
  });

  // School filter needs the id, which the row doesn't carry — match on the
  // resolved display name instead so "Other" free-text entries behave too.
  const schoolName = schools?.find((s) => s.id === filters.schoolId)?.name;
  const scoped = filters.schoolId
    ? rows.filter((r) => r.schoolName === schoolName)
    : rows;

  const byName = (a: ApplicantRow, b: ApplicantRow) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
  // Blank values sort last in either direction, so "no school yet" never
  // crowds the top of a list.
  const blankLast = (x: string, y: string, dir: 1 | -1) =>
    !x && !y ? 0 : !x ? 1 : !y ? -1 : dir * x.localeCompare(y);
  // Graduation years are text ("Before 2025", "2026"…); "Before" sorts earliest.
  const gradKey = (g: string | null) => (g ? (g.startsWith("Before") ? "0000" : g) : "");

  const sorted = [...scoped].sort((a, b) => {
    switch (filters.sort) {
      case "name_desc":
        return -byName(a, b);
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "progress":
        return b.completedCount - a.completedCount || byName(a, b);
      case "progress_asc":
        return a.completedCount - b.completedCount || byName(a, b);
      case "stage":
        return currentStage(a.statuses) - currentStage(b.statuses) || byName(a, b);
      case "stage_desc":
        return currentStage(b.statuses) - currentStage(a.statuses) || byName(a, b);
      case "school":
        return blankLast(a.schoolName, b.schoolName, 1) || byName(a, b);
      case "school_desc":
        return blankLast(a.schoolName, b.schoolName, -1) || byName(a, b);
      case "grad":
        return blankLast(gradKey(a.graduationYear), gradKey(b.graduationYear), 1) || byName(a, b);
      case "grad_desc":
        return blankLast(gradKey(a.graduationYear), gradKey(b.graduationYear), -1) || byName(a, b);
      default:
        return byName(a, b);
    }
  });

  return { rows: sorted, schools: schools ?? [], total: all.length };
}
