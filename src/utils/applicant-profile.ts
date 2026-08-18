import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";
import type { StepStatus } from "@/utils/steps";

export type ProfileDocument = {
  id: string;
  docType: string;
  fileName: string;
  storagePath: string;
  createdAt: string;
};

export type ProfileNote = {
  id: string;
  body: string;
  authorEmail: string;
  createdAt: string;
};

export type AuditEntry = {
  id: number;
  action: string;
  actorEmail: string | null;
  createdAt: string;
};

export type ApplicantProfile = {
  applicationId: string;
  studentId: string;
  student: {
    firstName: string;
    lastName: string;
    preferredName: string | null;
    email: string;
    phone: string | null;
    dateOfBirth: string | null;
    notificationPreference: string | null;
  };
  application: Record<string, unknown>;
  schoolName: string;
  isPartnerSchool: boolean;
  statuses: Record<number, StepStatus>;
  guardians: {
    id: string;
    position: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    relationship: string;
  }[];
  demographics: Record<string, unknown> | null;
  parentForm: Record<string, unknown> | null;
  essays: { prompt: string; response: string }[];
  documents: ProfileDocument[];
  notes: ProfileNote[];
  audit: AuditEntry[];
  parentLinkUrl: string;
  interview: {
    recorded: boolean;
    interviewDate: string | null;
    finalRating: number | null;
    interviewers: string | null;
  };
  decision: {
    status: string | null;
    notes: string | null;
    decidedAt: string | null;
    releasedAt: string | null;
  };
};

/**
 * Everything staff need on one applicant. Read through the ADMIN's own
 * session (not the service role) so RLS is still the gatekeeper — every table
 * here already has an `is_admin()` policy, and a deactivated admin is
 * therefore rejected at the database, not just in the UI.
 */
export async function getApplicantProfile(
  applicationId: string,
): Promise<ApplicantProfile | null> {
  const supabase = createClient(await cookies());

  const { data: application } = await supabase
    .from("applications")
    .select(
      `*, students ( first_name, last_name, preferred_name, email, phone, date_of_birth, notification_preference ),
       schools ( name, is_partner ), step_progress ( step_number, status )`,
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return null;

  const [
    { data: guardians },
    { data: demographics },
    { data: parentForm },
    { data: essayRows },
    { data: documents },
    { data: notes },
    { data: audit },
    { data: interview },
    { data: decision },
  ] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, position, first_name, last_name, email, phone, relationship")
      .eq("application_id", applicationId)
      .order("position"),
    supabase
      .from("demographics")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle(),
    supabase
      .from("parent_form_submissions")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle(),
    supabase
      .from("essay_responses")
      .select("response, essay_prompts ( prompt, sort_order )")
      .eq("application_id", applicationId),
    supabase
      .from("documents")
      .select("id, doc_type, file_name, storage_path, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("admin_notes")
      .select("id, body, created_at, admin_users ( email )")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_log")
      .select("id, action, actor_email, created_at")
      .eq("entity_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("interviews")
      .select("interview_date, final_rating, interviewers")
      .eq("application_id", applicationId)
      .maybeSingle(),
    supabase
      .from("decisions")
      .select("status, notes, decided_at, released_at")
      .eq("application_id", applicationId)
      .maybeSingle(),
  ]);

  const statuses: Record<number, StepStatus> = {};
  for (const sp of (application.step_progress ?? []) as {
    step_number: number;
    status: StepStatus;
  }[]) {
    statuses[sp.step_number] = sp.status;
  }

  const student = application.students as {
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
    notification_preference: string | null;
  } | null;

  const school = application.schools as {
    name: string | null;
    is_partner: boolean | null;
  } | null;

  const essays = ((essayRows ?? []) as unknown as {
    response: string;
    essay_prompts: { prompt: string; sort_order: number } | null;
  }[])
    .map((e) => ({
      prompt: e.essay_prompts?.prompt ?? "(prompt removed)",
      response: e.response ?? "",
      sort: e.essay_prompts?.sort_order ?? 0,
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ prompt, response }) => ({ prompt, response }));

  const origin = await getOrigin();

  return {
    applicationId,
    studentId: application.student_id as string,
    student: {
      firstName: student?.first_name ?? "",
      lastName: student?.last_name ?? "",
      preferredName: student?.preferred_name ?? null,
      email: student?.email ?? "",
      phone: student?.phone ?? null,
      dateOfBirth: student?.date_of_birth ?? null,
      notificationPreference: student?.notification_preference ?? null,
    },
    application: application as Record<string, unknown>,
    schoolName: school?.name ?? (application.school_other as string) ?? "",
    isPartnerSchool: Boolean(school?.is_partner),
    statuses,
    guardians: (guardians ?? []).map((g) => ({
      id: g.id as string,
      position: g.position as number,
      firstName: g.first_name ?? "",
      lastName: g.last_name ?? "",
      email: g.email ?? "",
      phone: g.phone ?? "",
      relationship: g.relationship ?? "",
    })),
    demographics: (demographics as Record<string, unknown>) ?? null,
    parentForm: (parentForm as Record<string, unknown>) ?? null,
    essays,
    documents: (documents ?? []).map((d) => ({
      id: d.id as string,
      docType: d.doc_type as string,
      fileName: d.file_name as string,
      storagePath: d.storage_path as string,
      createdAt: d.created_at as string,
    })),
    notes: ((notes ?? []) as unknown as {
      id: string;
      body: string;
      created_at: string;
      admin_users: { email: string } | null;
    }[]).map((n) => ({
      id: n.id,
      body: n.body,
      authorEmail: n.admin_users?.email ?? "Launchpad staff",
      createdAt: n.created_at,
    })),
    audit: (audit ?? []).map((a) => ({
      id: a.id as number,
      action: a.action as string,
      actorEmail: (a.actor_email as string | null) ?? null,
      createdAt: a.created_at as string,
    })),
    parentLinkUrl: `${origin}/parent/${application.parent_link_token}`,
    interview: {
      recorded: Boolean(interview),
      interviewDate: (interview?.interview_date as string) ?? null,
      finalRating: (interview?.final_rating as number) ?? null,
      interviewers: (interview?.interviewers as string) ?? null,
    },
    decision: {
      status: (decision?.status as string) ?? null,
      notes: (decision?.notes as string) ?? null,
      decidedAt: (decision?.decided_at as string) ?? null,
      releasedAt: (decision?.released_at as string) ?? null,
    },
  };
}
