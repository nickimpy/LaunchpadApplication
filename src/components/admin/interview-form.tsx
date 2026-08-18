"use client";

import { useActionState } from "react";
import { saveInterview } from "@/app/(admin)/admin/applicants/[id]/interview/actions";
import type { InterviewData } from "@/utils/interview";
import {
  RUBRIC_CRITERIA,
  SCORE_OPTIONS,
  PATHWAY_OPTIONS,
  scoreField,
  noteField,
  type InterviewState,
} from "@/utils/interview-options";
import {
  Alert,
  SelectField,
  TextField,
  Textarea,
  SubmitButton,
  useStatusFocus,
} from "@/components/forms";

export function InterviewForm({ data }: { data: InterviewData }) {
  const [state, action] = useActionState<InterviewState, FormData>(
    saveInterview.bind(null, data.applicationId),
    {},
  );
  const statusRef = useStatusFocus(state);
  // Echoed values win over stored ones: React 19 resets the form after an
  // action, so anything not handed back disappears from the screen.
  const v = { ...data.values, ...(state.values ?? {}) };

  return (
    <>
      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {state.success && <Alert tone="success">{state.success}</Alert>}
        {state.error && <Alert tone="error">{state.error}</Alert>}
      </div>

      <form action={action}>
        <section className="mb-6 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-bold">The interview</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            <TextField
              label="Interview date"
              name="interview_date"
              type="date"
              defaultValue={v.interview_date}
            />
            <TextField
              label="Interviewer(s)"
              name="interviewers"
              defaultValue={v.interviewers}
              optional
              hint="Who was in the room."
            />
          </div>
          <SelectField
            label="Pathway preference"
            name="pathway_preference"
            options={PATHWAY_OPTIONS}
            defaultValue={v.pathway_preference}
            optional
            placeholder="Not recorded"
          />
          <Textarea
            label="Schedule conflicts noted during pre-screening"
            name="schedule_conflicts"
            defaultValue={v.schedule_conflicts}
            optional
            rows={3}
            hint="Work, sports, family commitments. Excessive conflicts may affect the Purpose score."
          />
          <Textarea
            label="College plans noted during pre-screening"
            name="college_plans"
            defaultValue={v.college_plans}
            optional
            rows={3}
          />
        </section>

        <section className="mb-6 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold">Rubric</h2>
          <p className="mb-6 text-xs">
            Score each criterion 0–3. Leave one blank if it wasn&apos;t
            assessed — blank scores are cleared from the record.
          </p>
          {RUBRIC_CRITERIA.map((c) => (
            <div
              key={c.value}
              className="mb-6 border-t border-grey-tint3 pt-6 first:border-0 first:pt-0"
            >
              <SelectField
                label={c.label}
                name={scoreField(c.value)}
                options={SCORE_OPTIONS}
                defaultValue={v[scoreField(c.value)] ?? ""}
                optional
                hint={c.hint}
                placeholder="Not scored"
              />
              <Textarea
                label={`Notes on ${c.label.toLowerCase()}`}
                name={noteField(c.value)}
                defaultValue={v[noteField(c.value)] ?? ""}
                optional
                rows={2}
              />
            </div>
          ))}
        </section>

        <section className="mb-6 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-bold">Committee outcome</h2>
          <SelectField
            label="Final agreed rating"
            name="final_rating"
            options={SCORE_OPTIONS}
            defaultValue={v.final_rating}
            optional
            hint="The rating staff agreed on after the interview."
            placeholder="Not decided yet"
          />
          <Textarea
            label="Overall notes"
            name="overall_notes"
            defaultValue={v.overall_notes}
            optional
            rows={5}
          />
          <SubmitButton pendingLabel="Saving…">
            {data.recorded ? "Update interview" : "Record interview"}
          </SubmitButton>
          {!data.recorded && (
            <p className="mt-3 text-xs">
              Saving this marks Step 4 complete for the student.
            </p>
          )}
        </section>
      </form>
    </>
  );
}
