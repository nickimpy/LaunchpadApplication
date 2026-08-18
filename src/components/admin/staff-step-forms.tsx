"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  verifyC2LStep,
  recordDecision,
  releaseDecision,
  type VerifyState,
} from "@/app/(admin)/admin/applicants/[id]/staff-actions";
import { DECISION_OPTIONS, DECISION_LABELS, type DecisionState } from "@/utils/decision-options";
import { Alert, SelectField, Textarea, SubmitButton } from "@/components/forms";
import { STATUS_LABELS, type StepStatus } from "@/utils/steps";
import { formatDateTime } from "@/utils/dates";

/** One C2L step's verify / un-verify control. */
export function C2LVerifyRow({
  applicationId,
  stepNumber,
  stepName,
  status,
}: {
  applicationId: string;
  stepNumber: number;
  stepName: string;
  status: StepStatus;
}) {
  const verified = status === "complete";
  const [state, action] = useActionState<VerifyState, FormData>(
    async () => verifyC2LStep(applicationId, stepNumber, !verified),
    {},
  );

  return (
    <div className="border-t border-grey-tint3 py-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="font-bold">
            Step {stepNumber}: {stepName}
          </span>
          <span className="block text-xs">{STATUS_LABELS[status]}</span>
        </span>
        <form action={action}>
          <button
            type="submit"
            disabled={status === "not_started"}
            className={`rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs font-bold
              hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark disabled:opacity-50
              ${verified ? "text-orange-dark" : "text-teal-dark"}`}
          >
            {verified ? "Un-verify" : "Verify with C2LPHL"}
          </button>
        </form>
      </div>
      {status === "not_started" && (
        <p className="mt-1 text-xs text-grey-tint1">
          The student hasn&apos;t reported this yet.
        </p>
      )}
      {state.error && <p className="mt-1 text-xs text-orange-dark">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-dark">{state.success}</p>}
    </div>
  );
}

/** Record a decision, then release it as a separate, deliberate step. */
export function DecisionPanel({
  applicationId,
  status,
  notes,
  decidedAt,
  releasedAt,
}: {
  applicationId: string;
  status: string | null;
  notes: string | null;
  decidedAt: string | null;
  releasedAt: string | null;
}) {
  const [recordState, recordAction] = useActionState<DecisionState, FormData>(
    recordDecision.bind(null, applicationId),
    {},
  );
  const [releaseState, releaseAction] = useActionState<DecisionState, FormData>(
    async () => releaseDecision(applicationId),
    {},
  );

  return (
    <>
      {recordState.success && <Alert tone="success">{recordState.success}</Alert>}
      {recordState.error && <Alert tone="error">{recordState.error}</Alert>}
      {releaseState.success && <Alert tone="success">{releaseState.success}</Alert>}
      {releaseState.error && <Alert tone="error">{releaseState.error}</Alert>}

      {status && (
        <div
          className={`mb-6 rounded-md border-l-4 px-3 py-3 ${
            releasedAt
              ? "border-green-dark bg-green-tint3"
              : "border-orange-dark bg-orange-tint3"
          }`}
        >
          <p className="font-bold">{DECISION_LABELS[status] ?? status}</p>
          <p className="mt-1 text-xs">
            {releasedAt
              ? `Released to the student ${formatDateTime(releasedAt)} — they can see it in their portal.`
              : "Not released. The student cannot see this yet."}
            {decidedAt ? ` Recorded ${formatDateTime(decidedAt)}.` : ""}
          </p>
        </div>
      )}

      <form action={recordAction}>
        <SelectField
          label="Decision"
          name="status"
          options={DECISION_OPTIONS}
          defaultValue={status ?? ""}
          placeholder="Choose a decision…"
        />
        <Textarea
          label="Internal notes"
          name="notes"
          defaultValue={notes ?? ""}
          optional
          rows={3}
          hint="Staff only — never shown to the student."
        />
        <SubmitButton pendingLabel="Saving…">
          {status ? "Update decision" : "Record decision"}
        </SubmitButton>
      </form>

      {status && !releasedAt && (
        <form action={releaseAction} className="mt-6 border-t border-grey-tint3 pt-6">
          <h3 className="mb-3 font-bold">Release to the student</h3>
          <p className="mb-3 text-xs">
            This reveals the decision in the student&apos;s portal immediately.
            It does <strong>not</strong> send an email yet — decision emails
            arrive in Phase 9. Tell them another way for now.
          </p>
          <button
            type="submit"
            className="rounded-md bg-orange px-3 py-3 text-base font-bold text-white
              hover:brightness-110 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark focus-visible:ring-offset-2"
          >
            Release decision to student
          </button>
        </form>
      )}
    </>
  );
}

/** Compact interview summary with a link into the full rubric. */
export function InterviewSummary({
  applicationId,
  recorded,
  interviewDate,
  finalRating,
  interviewers,
}: {
  applicationId: string;
  recorded: boolean;
  interviewDate: string | null;
  finalRating: number | null;
  interviewers: string | null;
}) {
  return (
    <>
      {recorded ? (
        <dl className="mb-6">
          <div className="mb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-grey-tint1">
              Interviewed
            </dt>
            <dd>{interviewDate ?? "—"}</dd>
          </div>
          <div className="mb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-grey-tint1">
              Final rating
            </dt>
            <dd>{finalRating != null ? `${finalRating} of 3` : "Not decided yet"}</dd>
          </div>
          <div className="mb-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-grey-tint1">
              Interviewer(s)
            </dt>
            <dd>{interviewers ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="mb-6 text-xs">No interview recorded yet.</p>
      )}
      <Link
        className="inline-block rounded-md bg-teal-dark px-3 py-3 text-base font-bold text-white
          hover:brightness-110 focus:outline-none focus-visible:ring-2
          focus-visible:ring-teal-dark focus-visible:ring-offset-2"
        href={`/admin/applicants/${applicationId}/interview`}
      >
        {recorded ? "View / edit the rubric" : "Record the interview"}
      </Link>
    </>
  );
}
