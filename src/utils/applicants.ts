import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { StepStatus } from "@/utils/steps";

export type ApplicantFilters = {
  q: string;
  schoolId: string;
  program: string;
  track: string;
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
  track: string | null;
  collegeWarning: boolean;
  statuses: Record<number, StepStatus>;
  completedCount: number;
  createdAt: string;
};

export const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "progress", label: "Most complete first" },
  { value: "school", label: "School (A–Z)" },
] as const;

/** Parses raw searchParams into a normalized, trusted filter object. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ApplicantFilters {
  const one = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  return {
    q: one("q"),
    schoolId: one("school"),
    program: one("program"),
    track: one("track"),
    step: one("step"),
    status: one("status"),
    sort: one("sort") || "name",
  };
}

/** True when any filter is narrowing the list (drives the "clear" button). */
export function hasActiveFilters(f: ApplicantFilters): boolean {
  return Boolean(f.q || f.schoolId || f.program || f.track || (f.step && f.status));
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
        `id, student_id, school_id, school_other, graduation_year, program, track,
         college_warning_flagged, created_at,
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
    track: string | null;
    college_warning_flagged: boolean;
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
      track: a.track,
      collegeWarning: a.college_warning_flagged,
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
    if (filters.program && r.program !== filters.program) return false;
    if (filters.track && (r.track ?? "") !== filters.track) return false;
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

  const sorted = [...scoped].sort((a, b) => {
    switch (filters.sort) {
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "progress":
        return b.completedCount - a.completedCount;
      case "school":
        return a.schoolName.localeCompare(b.schoolName);
      default:
        return (
          a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
        );
    }
  });

  return { rows: sorted, schools: schools ?? [], total: all.length };
}
