import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortalData } from "@/utils/step-engine";
import { getStep1Data } from "@/utils/step1";
import { getStep3Data } from "@/utils/step3";
import { getC2LUrl } from "@/utils/c2l";
import { C2L_COPY, isC2LStep } from "@/utils/c2l-options";
import { getMyReleasedDecision } from "@/utils/decision";
import { DECISION_LABELS } from "@/utils/decision-options";
import { formatDate } from "@/utils/dates";
import { Step1Form } from "@/components/portal/step1-form";
import { Step3Form } from "@/components/portal/step3-form";
import { C2LReportForm } from "@/components/portal/c2l-report-form";
import { ParentLinkBox } from "@/components/portal/parent-link-box";
import { getParentLinkUrl } from "@/utils/parent-link";
import {
  STATUS_LABELS,
  TOTAL_STEPS,
  formatDeadline,
  getStepMeta,
  type StepStatus,
} from "@/utils/steps";

type Params = Promise<{ step: string }>;

function parseStep(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const stepNumber = parseStep((await params).step);
  const meta = stepNumber ? getStepMeta(stepNumber) : undefined;
  return {
    title: meta
      ? `Step ${meta.number}: ${meta.name} — Launchpad`
      : "Application — Launchpad",
  };
}

const BADGE_STYLES: Record<StepStatus, string> = {
  not_started: "bg-grey-tint3 text-grey",
  in_progress: "bg-teal-tint3 text-teal-dark",
  submitted: "bg-teal-dark text-white",
  pending_verification: "bg-orange-tint3 text-orange-dark",
  complete: "bg-green-tint3 text-green-dark",
};

/**
 * Step 2 is the parent's to complete, so the student's view is share-the-link
 * plus status. It deliberately does NOT show the parent's answers: those are
 * admin-only (parent_form_submissions has an admin-select RLS policy), and
 * staff-facing review belongs in the admin dashboard.
 */
async function Step2Panel({
  applicationId,
  complete,
}: {
  applicationId: string;
  complete: boolean;
}) {
  const url = await getParentLinkUrl(applicationId);

  if (complete) {
    return (
      <div className="rounded-lg border border-green-dark bg-green-tint3 p-6">
        <h2 className="mb-3 text-lg font-bold">
          Your parent / guardian form is in
        </h2>
        <p>
          Your parent or guardian submitted and signed their form — this step is
          done. Launchpad staff can see their answers; they aren&apos;t shown
          here.
        </p>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">
          Finish Step 1 to get your parent&apos;s link
        </h2>
        <p>
          As soon as you submit Step 1, we&apos;ll generate a link you can send
          to your parent or guardian so they can complete this step.
        </p>
      </div>
    );
  }

  return (
    <>
      <ParentLinkBox url={url} allowRegenerate />
      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">
          Waiting on your parent or guardian
        </h2>
        <p>
          They don&apos;t need an account — the link above opens their form
          directly, with your information already filled in. This step turns
          complete as soon as they sign and submit it.
        </p>
      </div>
    </>
  );
}

/**
 * Step 7. A decision the student can read is, by definition, one staff have
 * released: RLS hides unreleased rows entirely, so there is nothing to guard
 * against here beyond rendering what comes back.
 */
async function Step7Panel() {
  const decision = await getMyReleasedDecision();

  if (!decision) {
    return (
      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Your decision will appear here</h2>
        <p>
          There&apos;s nothing for you to do on this step. When your admissions
          decision is ready, we&apos;ll let you know and you can view it right
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-teal-dark bg-teal-tint3 p-6">
      <h2 className="mb-3 text-lg font-bold">Your admissions decision</h2>
      <p className="mb-3 text-2xl font-bold">
        {DECISION_LABELS[decision.status] ?? decision.status}
      </p>
      <p className="text-xs">
        Released {formatDate(decision.releasedAt)}. If you have questions about
        what this means, please get in touch with Launchpad staff.
      </p>
    </div>
  );
}

export default async function StepPage({ params }: { params: Params }) {
  const stepNumber = parseStep((await params).step);
  if (!stepNumber) notFound();

  const data = await getPortalData();
  if (!data) redirect("/login");

  const step = data.steps.find((s) => s.number === stepNumber);
  if (!step) notFound();

  const ownerLine =
    step.owner === "student"
      ? "You complete this step."
      : step.owner === "parent"
        ? "Your parent or guardian completes this step — they don't need an account."
        : "Launchpad staff complete this step.";

  return (
    <>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide">
        Step {step.number} of {TOTAL_STEPS}
      </p>
      <h1 className="mb-3 text-2xl font-bold">{step.name}</h1>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${BADGE_STYLES[step.status]}`}
        >
          {step.locked ? "Locked" : STATUS_LABELS[step.status]}
        </span>
        <span className="text-xs">
          {step.deadline
            ? `Due ${formatDeadline(step.deadline)}`
            : "No deadline set yet"}
        </span>
      </div>

      <p className="mb-3 font-bold">{ownerLine}</p>
      <p className="mb-6">{step.summary}</p>

      {step.number === 1 ? (
        <Step1Form data={(await getStep1Data())!} />
      ) : step.locked ? (
        <div className="rounded-lg border border-grey-tint2 bg-grey-tint3 p-6">
          <h2 className="mb-3 text-lg font-bold">
            Complete Step 1 to unlock this step
          </h2>
          <p>
            Once you finish Step 1 (Student Information), Steps 2 through 6
            open up and you can work on them in any order.
          </p>
        </div>
      ) : step.number === 3 ? (
        <Step3Form data={(await getStep3Data())!} />
      ) : isC2LStep(step.number) ? (
        <C2LReportForm
          stepNumber={step.number}
          status={step.status}
          url={await getC2LUrl(data.cycleId, C2L_COPY[step.number].urlKey)}
          contactEmail={data.contactEmail}
        />
      ) : step.number === 7 ? (
        <Step7Panel />
      ) : step.owner === "staff" ? (
        <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">
            Launchpad staff update this step
          </h2>
          <p>
            This step is marked complete by Launchpad staff after your
            interview happens. We&apos;ll reach out with details about
            scheduling.
          </p>
        </div>
      ) : step.owner === "parent" ? (
        <Step2Panel
          applicationId={data.applicationId}
          complete={step.status === "complete"}
        />
      ) : (
        <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">This form is coming soon</h2>
          <p className="mb-3">
            This part of the application isn&apos;t open quite yet — check
            back soon. Your progress on every step is saved automatically.
          </p>
          <p className="text-xs">
            {step.maxStudentStatus === "pending_verification"
              ? "After you report this step, Launchpad staff verify it with C2LPHL — it will show “Pending verification” until they do."
              : "You'll be able to update your answers on this step even after you submit it."}
          </p>
        </div>
      )}

      <p className="mt-6 text-xs">
        Questions about this step? Email{" "}
        <a
          className="text-teal-dark underline"
          href={`mailto:${data.contactEmail}`}
        >
          {data.contactEmail}
        </a>
        .
      </p>
    </>
  );
}
