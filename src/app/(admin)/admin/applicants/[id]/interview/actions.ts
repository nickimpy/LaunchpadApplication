"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { field } from "@/utils/validation";
import {
  RUBRIC_CRITERIA,
  SCORE_VALUES,
  PATHWAY_VALUES,
  INTERVIEWERS_FIELD,
  scoreField,
  noteField,
  type InterviewState,
} from "@/utils/interview-options";

const DENIED = "You don't have permission to do that.";
const FAILED = "That didn't save. Please try again.";

/**
 * Records (or updates) an interview: the 7-criterion rubric, pathway
 * preference, pre-screening notes, and the committee's final rating.
 *
 * Saving marks Step 4 complete — interviews are staff-owned, so this writes
 * `step_progress` directly rather than going through `setStepStatus()`, which
 * only handles student-actionable steps.
 */
export async function saveInterview(
  applicationId: string,
  _prev: InterviewState,
  formData: FormData,
): Promise<InterviewState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  // Interviewers are chosen from the staff list, so this arrives as ids.
  const interviewerIds = formData.getAll(INTERVIEWERS_FIELD).map(String).filter(Boolean);

  const values: Record<string, string> = {
    interview_date: field(formData, "interview_date"),
    interviewers: interviewerIds.join(","),
    pathway_preference: field(formData, "pathway_preference"),
    schedule_conflicts: field(formData, "schedule_conflicts"),
    college_plans: field(formData, "college_plans"),
    overall_notes: field(formData, "overall_notes"),
    final_rating: field(formData, "final_rating"),
  };
  for (const c of RUBRIC_CRITERIA) {
    values[scoreField(c.value)] = field(formData, scoreField(c.value));
    values[noteField(c.value)] = field(formData, noteField(c.value));
  }

  // A recorded interview is a complete rubric: every criterion scored, and the
  // interviewers named. Notes stay optional.
  if (!values.interview_date) {
    return { error: "Enter the interview date.", values };
  }
  if (interviewerIds.length === 0) {
    return { error: "Choose at least one interviewer.", values };
  }
  if (values.pathway_preference && !PATHWAY_VALUES.includes(values.pathway_preference)) {
    return { error: "Choose a valid pathway preference.", values };
  }
  if (values.final_rating && !SCORE_VALUES.includes(values.final_rating)) {
    return { error: "Choose a valid final rating.", values };
  }
  const unscored = RUBRIC_CRITERIA.filter(
    (c) => !SCORE_VALUES.includes(values[scoreField(c.value)]),
  );
  if (unscored.length) {
    return {
      error: `Score every criterion before saving. Still missing: ${unscored
        .map((c) => c.label)
        .join(", ")}.`,
      values,
    };
  }

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("interviews")
    .select("id, interview_date, final_rating")
    .eq("application_id", applicationId)
    .maybeSingle();

  const { data: interview, error: upsertErr } = await supabase
    .from("interviews")
    .upsert(
      {
        application_id: applicationId,
        interview_date: values.interview_date,
        interviewers: values.interviewers || null,
        pathway_preference: values.pathway_preference || null,
        schedule_conflicts: values.schedule_conflicts || null,
        college_plans: values.college_plans || null,
        overall_notes: values.overall_notes || null,
        final_rating: values.final_rating ? Number(values.final_rating) : null,
        recorded_by: admin.id,
      },
      { onConflict: "application_id" },
    )
    .select("id")
    .single();
  if (upsertErr || !interview) return { error: FAILED, values };

  // All 7 are validated above, so this always writes a full rubric.
  const { error: scoreErr } = await supabase.from("interview_scores").upsert(
    RUBRIC_CRITERIA.map((c) => ({
      interview_id: interview.id,
      criterion: c.value,
      score: Number(values[scoreField(c.value)]),
      note: values[noteField(c.value)] || null,
    })),
    { onConflict: "interview_id,criterion" },
  );
  if (scoreErr) return { error: FAILED, values };

  // Step 4 is staff-owned: setStepStatus() rejects it, so write directly.
  const now = new Date().toISOString();
  const { error: stepErr } = await supabase
    .from("step_progress")
    .update({
      status: "complete",
      submitted_at: now,
      completed_at: now,
      updated_by: admin.id,
    })
    .eq("application_id", applicationId)
    .eq("step_number", 4);
  if (stepErr) return { error: FAILED, values };

  await logAdminAction({
    actor: admin,
    action: before ? "interview.update" : "interview.record",
    entityType: "application",
    entityId: applicationId,
    before,
    after: { interview_date: values.interview_date, final_rating: values.final_rating },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  revalidatePath(`/admin/applicants/${applicationId}/interview`);

  return {
    success: before
      ? "Interview updated."
      : "Interview recorded — Step 4 is now complete.",
    values,
  };
}
