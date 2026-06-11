import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalData } from "@/utils/step-engine";
import { TOTAL_STEPS, formatDeadline } from "@/utils/steps";

export const metadata: Metadata = { title: "Your application — Launchpad" };

export default async function PortalHome() {
  const data = await getPortalData();
  if (!data) redirect("/login");

  const name = data.student.preferred_name || data.student.first_name;

  // The next thing the student can actually do: first unlocked, student-owned
  // step they haven't started or finished. Submitted/pending steps count as
  // done from the student's side (staff take it from there).
  const nextStep = data.steps.find(
    (s) =>
      s.studentActionable &&
      !s.locked &&
      (s.status === "not_started" || s.status === "in_progress"),
  );

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Welcome, {name}!</h1>
      <p className="mb-6">
        This is your application to Launchpad for the {data.cycleName} cycle.
        Work through the steps at your own pace — you can save and come back
        anytime, and you can update a step even after you submit it.
      </p>
      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">
          {data.completedCount} of {TOTAL_STEPS} steps complete
        </h2>
        {nextStep ? (
          <>
            <p className="mb-6">
              {nextStep.status === "in_progress"
                ? "Pick up where you left off:"
                : "Your next step:"}{" "}
              <span className="font-bold">
                Step {nextStep.number} — {nextStep.name}
              </span>
              {nextStep.deadline &&
                ` (due ${formatDeadline(nextStep.deadline)})`}
              .
            </p>
            <Link
              href={`/portal/steps/${nextStep.number}`}
              className="inline-block rounded-md bg-teal-dark px-6 py-3 text-base font-bold
                text-white hover:brightness-110 focus:outline-none focus-visible:ring-2
                focus-visible:ring-teal-dark focus-visible:ring-offset-2"
            >
              {nextStep.status === "in_progress"
                ? `Continue Step ${nextStep.number}`
                : `Start Step ${nextStep.number}`}
            </Link>
          </>
        ) : (
          <p>
            You&apos;ve finished everything you can do for now — nice work.
            We&apos;ll email you when there&apos;s news or anything else we
            need from you.
          </p>
        )}
      </div>
      <p className="text-xs">
        Questions? Email{" "}
        <a
          className="text-teal-dark underline"
          href={`mailto:${data.contactEmail}`}
        >
          {data.contactEmail}
        </a>{" "}
        — we&apos;re happy to help.
      </p>
    </>
  );
}
