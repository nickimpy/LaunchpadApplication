import { type NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/utils/admin";
import { getApplicants, parseFilters } from "@/utils/applicants";
import { STEPS, STATUS_LABELS, type StepStatus } from "@/utils/steps";

/** RFC 4180 escaping: quote everything, double any embedded quotes. */
function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * On-demand CSV of the applicant list, honouring the same filters as the
 * table (the export link carries the page's query string).
 *
 * Contains applicant PII, so it re-checks admin access itself rather than
 * relying on the layout — route handlers don't run inside layouts.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Not found", { status: 404 });

  const { searchParams } = new URL(request.url);
  const filters = parseFilters(Object.fromEntries(searchParams.entries()));
  const { rows } = await getApplicants(filters);

  const header = [
    "Last name",
    "First name",
    "Preferred name",
    "Email",
    "Phone",
    "School",
    "Partner school",
    "Graduation year",
    "Program",
    "Interview track",
    "College plan flagged",
    ...STEPS.map((s) => `Step ${s.number}: ${s.name}`),
    "Steps complete",
    "Applied",
  ];

  const body = rows.map((r) =>
    [
      r.lastName,
      r.firstName,
      r.preferredName ?? "",
      r.email,
      r.phone ?? "",
      r.schoolName,
      r.isPartnerSchool ? "Yes" : "No",
      r.graduationYear ?? "",
      r.program ?? "",
      r.track ?? "",
      r.collegeWarning ? "Yes" : "No",
      ...STEPS.map(
        (s) => STATUS_LABELS[(r.statuses[s.number] ?? "not_started") as StepStatus],
      ),
      `${r.completedCount}/7`,
      r.createdAt.slice(0, 10),
    ].map(cell),
  );

  // BOM so Excel opens UTF-8 names correctly.
  const csv = "﻿" + [header.map(cell), ...body].map((r) => r.join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="launchpad-applicants-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
