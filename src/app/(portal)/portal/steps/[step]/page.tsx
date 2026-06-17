import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPortalData } from "@/utils/step-engine";
import { getStep1Data } from "@/utils/step1";
import { Step1Form } from "@/components/portal/step1-form";
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
      ) : step.number === 7 ? (
        <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">
            Your decision will appear here
          </h2>
          <p>
            There&apos;s nothing for you to do on this step. When your
            admissions decision is ready, we&apos;ll email you and you can
            view it right here.
          </p>
        </div>
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
        <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">
            Your parent or guardian takes it from here
          </h2>
          <p>
            When you finished Step 1, we sent your parent or guardian a link to
            their form by email (and text, if they opted in).
            You&apos;ll also be able to copy the link yourself to share with
            them. This step turns complete as soon as they submit.
          </p>
        </div>
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
