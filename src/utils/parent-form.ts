import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

// Everything here runs with NO Supabase session — parents never have accounts.
// The link token IS the access control, so every read goes through the
// service-role client: `anon` has zero table grants (see migration 0002) and
// the students/applications/cycle_settings policies are all auth.uid()-scoped,
// so an unauthenticated request cannot read any of this any other way.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ParentFormData = {
  applicationId: string;
  studentName: string;
  studentFirstName: string;
  dateOfBirth: string;
  schoolName: string;
  program: "lightspeed" | "foundations" | null;
  programInfo: string;
  consentText: string;
  summerLocation: string;
  summerDates: string;
  contactEmail: string;
  guardianPrefill: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    relationship: string;
  } | null;
};

export type ParentFormLookup =
  | { kind: "not_found" }
  | {
      kind: "already_submitted";
      submittedAt: string;
      studentFirstName: string;
      contactEmail: string;
    }
  | { kind: "form"; data: ParentFormData };

const asText = (v: unknown) => (typeof v === "string" ? v : "");
const DEFAULT_CONTACT_EMAIL = "info@launchpadphilly.org";

/**
 * Resolves a parent link token to everything the form needs. Returns
 * `not_found` for a bad/rotated token and `already_submitted` once the form has
 * been signed, so the page never re-renders a form that's already done.
 */
export async function loadParentForm(
  rawToken: string,
): Promise<ParentFormLookup> {
  const token = rawToken.trim();
  // A non-UUID string compared against a uuid column is a Postgres error, not
  // an empty result — bail before querying so a junk URL 404s cleanly.
  if (!UUID_RE.test(token)) return { kind: "not_found" };

  const supabase = createAdminClient();

  const { data: application, error } = await supabase
    .from("applications")
    .select(
      `id, cycle_id, program, school_other,
       students ( first_name, last_name, date_of_birth ),
       schools ( name )`,
    )
    .eq("parent_link_token", token)
    .maybeSingle();

  if (error || !application) return { kind: "not_found" };

  const student = application.students as unknown as {
    first_name: string;
    last_name: string;
    date_of_birth: string;
  } | null;
  if (!student) return { kind: "not_found" };

  const [{ data: submission }, { data: settingRows }, { data: guardian }] =
    await Promise.all([
      supabase
        .from("parent_form_submissions")
        .select("signed_at")
        .eq("application_id", application.id)
        .maybeSingle(),
      // Scoped to the application's OWN cycle, not the active one — a parent
      // may open an old link after the cycle rolled over.
      supabase
        .from("cycle_settings")
        .select("key, value")
        .eq("cycle_id", application.cycle_id),
      supabase
        .from("guardians")
        .select("first_name, last_name, email, phone, relationship")
        .eq("application_id", application.id)
        .eq("position", 1)
        .maybeSingle(),
    ]);

  const settings = new Map(settingRows?.map((r) => [r.key, r.value]) ?? []);
  const contactEmail =
    asText(settings.get("contact_email")) || DEFAULT_CONTACT_EMAIL;

  if (submission) {
    return {
      kind: "already_submitted",
      submittedAt: submission.signed_at as string,
      studentFirstName: student.first_name,
      contactEmail,
    };
  }

  const program = (application.program as ParentFormData["program"]) ?? null;
  const school = application.schools as unknown as { name: string } | null;

  return {
    kind: "form",
    data: {
      applicationId: application.id,
      studentName: `${student.first_name} ${student.last_name}`.trim(),
      studentFirstName: student.first_name,
      dateOfBirth: student.date_of_birth,
      schoolName: school?.name || application.school_other || "",
      program,
      programInfo: asText(
        settings.get(
          program === "lightspeed"
            ? "program_info_lightspeed"
            : "program_info_foundations",
        ),
      ),
      consentText: asText(settings.get("parent_form_consent_text")),
      summerLocation: asText(settings.get("summer_location")),
      summerDates: asText(settings.get("summer_dates")),
      contactEmail,
      guardianPrefill: guardian
        ? {
            first_name: guardian.first_name ?? "",
            last_name: guardian.last_name ?? "",
            email: guardian.email ?? "",
            phone: guardian.phone ?? "",
            relationship: guardian.relationship ?? "",
          }
        : null,
    },
  };
}
