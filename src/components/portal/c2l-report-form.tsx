"use client";

import { useActionState } from "react";
import { reportC2LStep } from "@/app/(portal)/portal/steps/c2l-actions";
import {
  C2L_COPY,
  type C2LState,
  type C2LStepNumber,
} from "@/utils/c2l-options";
import { Alert, SubmitButton } from "@/components/forms";
import type { StepStatus } from "@/utils/steps";

/**
 * Steps 5 and 6: the student does the work on C2LPHL's site, then reports it
 * here. Staff verify it afterwards, so this never reaches "complete" on its
 * own — the step sits at "Pending verification" until they confirm it.
 */
export function C2LReportForm({
  stepNumber,
  status,
  url,
  contactEmail,
  staffNote,
}: {
  stepNumber: C2LStepNumber;
  status: StepStatus;
  url: string;
  contactEmail: string;
  staffNote: string;
}) {
  const [state, action] = useActionState<C2LState, FormData>(
    reportC2LStep.bind(null, stepNumber),
    {},
  );
  const copy = C2L_COPY[stepNumber];
  const verified = status === "complete";
  const reported = status === "pending_verification";
  // Staff reviewed it and something was wrong. The note says what.
  const needsFix = status === "needs_attention";

  return (
    <>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      {needsFix && (
        <div className="mb-6 rounded-lg border-l-4 border-orange-dark bg-orange-tint3 px-3 py-3">
          <h2 className="mb-3 text-lg font-bold">
            Launchpad staff checked this — something&apos;s missing
          </h2>
          {staffNote ? (
            <p className="mb-3 whitespace-pre-line">{staffNote}</p>
          ) : (
            <p className="mb-3">
              Please check your C2LPHL submission and try again.
            </p>
          )}
          <p className="text-xs">
            Fix it on C2LPHL&apos;s site, then report it again below and
            we&apos;ll take another look.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">What to do</h2>
        <ol className="mb-6 list-decimal space-y-3 pl-6">
          {copy.instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-teal-dark px-3 py-3 text-base font-bold
              text-white hover:brightness-110 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark focus-visible:ring-offset-2"
          >
            {copy.linkLabel} (opens in a new tab)
          </a>
        ) : (
          <p className="text-xs">
            We&apos;ll post the C2LPHL link here as soon as it&apos;s
            available. In the meantime, email{" "}
            <a
              className="text-teal-dark underline"
              href={`mailto:${contactEmail}`}
            >
              {contactEmail}
            </a>{" "}
            if you need it sooner.
          </p>
        )}
      </div>

      {verified ? (
        <div className="mt-6 rounded-lg border border-green-dark bg-green-tint3 p-6">
          <h2 className="mb-3 text-lg font-bold">Verified by Launchpad</h2>
          <p>
            Launchpad staff have confirmed this step with C2LPHL — there&apos;s
            nothing else for you to do here.
          </p>
        </div>
      ) : (
        <form action={action} className="mt-6">
          <fieldset className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
            <legend className="px-1 font-bold">Report it here</legend>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="reported"
                defaultChecked={reported || needsFix}
                className="mt-1 h-5 w-5 shrink-0 accent-teal-dark"
              />
              <span>{copy.checkboxLabel}</span>
            </label>

            <p className="mb-6 mt-3 text-xs">
              Checking this tells us you&apos;re done on C2LPHL&apos;s side.
              Launchpad staff verify it against C2LPHL&apos;s reports, so this
              step shows &ldquo;Pending verification&rdquo; until they do —
              that&apos;s normal, and there&apos;s nothing more for you to do
              while you wait.
            </p>

            <SubmitButton pendingLabel="Saving…">
              {needsFix
                ? "I fixed it — check again"
                : reported
                  ? "Update my report"
                  : "Submit my report"}
            </SubmitButton>
          </fieldset>
        </form>
      )}
    </>
  );
}
