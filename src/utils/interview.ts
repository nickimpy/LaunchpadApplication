import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { StepStatus } from "@/utils/steps";

export type InterviewData = {
  applicationId: string;
  studentName: string;
  schoolName: string;
  isPartnerSchool: boolean;
  track: string | null;
  program: string | null;
  /** Rubric criterion 6 requires the parent form, so its status is shown. */
  parentFormStatus: StepStatus;
  parentFormSubmitted: boolean;
  /** Criterion 7 rates the short answers, so they're shown inline. */
  essays: { prompt: string; response: string }[];
  recorded: boolean;
  values: Record<string, string>;
  /** Active staff, for the required Interviewer(s) picker. */
  staff: { id: string; name: string }[];
  /** Ids of staff already recorded on this interview. */
  interviewerIds: string[];
};

/**
 * Everything the interview form needs, including the two things the rubric
 * explicitly depends on: whether the parent/guardian form is in (criterion 6,
 * External support) and the student's short answers (criterion 7,
 * Communication). Interviewers verify both during pre-screening per the PRD.
 */
export async function getInterviewData(
  applicationId: string,
): Promise<InterviewData | null> {
  const supabase = createClient(await cookies());

  const { data: application } = await supabase
    .from("applications")
    .select(
      `id, track, program,
       students ( first_name, last_name, preferred_name ),
       schools ( name, is_partner ),
       step_progress ( step_number, status )`,
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return null;

  const [{ data: interview }, { data: parentForm }, { data: essayRows }, { data: staffRows }] =
    await Promise.all([
      supabase
        .from("interviews")
        .select("*, interview_scores ( criterion, score, note )")
        .eq("application_id", applicationId)
        .maybeSingle(),
      supabase
        .from("parent_form_submissions")
        .select("id")
        .eq("application_id", applicationId)
        .maybeSingle(),
      supabase
        .from("essay_responses")
        .select("response, essay_prompts ( prompt, sort_order )")
        .eq("application_id", applicationId),
      supabase
        .from("admin_users")
        .select("id, email, first_name, last_name")
        .eq("is_active", true)
        .order("first_name"),
    ]);

  const student = application.students as unknown as {
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
  } | null;
  const school = application.schools as unknown as {
    name: string | null;
    is_partner: boolean | null;
  } | null;

  const statuses = new Map(
    ((application.step_progress ?? []) as { step_number: number; status: StepStatus }[]).map(
      (s) => [s.step_number, s.status],
    ),
  );

  const values: Record<string, string> = {
    interview_date: (interview?.interview_date as string) ?? "",
    interviewers: (interview?.interviewers as string) ?? "",
    pathway_preference: (interview?.pathway_preference as string) ?? "",
    schedule_conflicts: (interview?.schedule_conflicts as string) ?? "",
    college_plans: (interview?.college_plans as string) ?? "",
    overall_notes: (interview?.overall_notes as string) ?? "",
    final_rating:
      interview?.final_rating != null ? String(interview.final_rating) : "",
  };
  for (const s of (interview?.interview_scores ?? []) as {
    criterion: string;
    score: number;
    note: string | null;
  }[]) {
    values[`score_${s.criterion}`] = String(s.score);
    values[`note_${s.criterion}`] = s.note ?? "";
  }

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

  const staff = (staffRows ?? []).map((a) => ({
    id: a.id as string,
    name:
      [a.first_name, a.last_name].filter(Boolean).join(" ") || (a.email as string),
  }));

  // Stored as a comma-separated list of admin ids, so the picker can round-trip
  // and a future "interviews I ran" filter has something to match on.
  const interviewerIds = String(interview?.interviewers ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((id) => staff.some((m) => m.id === id));

  return {
    applicationId,
    studentName: `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim(),
    schoolName: school?.name ?? "",
    isPartnerSchool: Boolean(school?.is_partner),
    track: (application.track as string) ?? null,
    program: (application.program as string) ?? null,
    parentFormStatus: statuses.get(2) ?? "not_started",
    parentFormSubmitted: Boolean(parentForm),
    essays,
    recorded: Boolean(interview),
    values,
    staff,
    interviewerIds,
  };
}
