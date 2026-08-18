import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInterviewData } from "@/utils/interview";
import { InterviewForm } from "@/components/admin/interview-form";
import { STATUS_LABELS } from "@/utils/steps";

export const metadata: Metadata = { title: "Interview — Launchpad Admin" };

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const data = await getInterviewData((await params).id);
  if (!data) notFound();

  return (
    <>
      <p className="mb-3 text-xs">
        <Link
          className="text-teal-dark underline"
          href={`/admin/applicants/${data.applicationId}`}
        >
          ← Back to {data.studentName || "applicant"}
        </Link>
      </p>
      <h1 className="text-2xl font-bold">Interview — {data.studentName}</h1>
      <p className="mb-6 text-xs">
        {data.schoolName || "No school on file"}
        {data.isPartnerSchool ? " · Partner school" : ""}
        {data.track ? ` · Track ${data.track}` : ""}
        {data.program ? ` · ${data.program}` : ""}
      </p>

      {/* Pre-screening context the rubric depends on: criterion 6 (External
          support) requires the parent form, and criterion 7 (Communication)
          rates the short answers. */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section
          className={`rounded-lg border p-6 ${
            data.parentFormSubmitted
              ? "border-green-dark bg-green-tint3"
              : "border-orange-dark bg-orange-tint3"
          }`}
        >
          <h2 className="mb-3 text-lg font-bold">Parent / guardian form</h2>
          <p>
            {data.parentFormSubmitted
              ? "Submitted and signed."
              : `Not submitted (${STATUS_LABELS[data.parentFormStatus]}).`}
          </p>
          <p className="mt-3 text-xs">
            Top marks on <strong>External support</strong> require a submitted
            parent/guardian form.
          </p>
        </section>

        <section className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Short answers (Step 3)</h2>
          {data.essays.length === 0 ? (
            <p className="text-xs">Nothing submitted yet.</p>
          ) : (
            data.essays.map((e) => (
              <details key={e.prompt} className="mb-3">
                <summary className="cursor-pointer font-bold">{e.prompt}</summary>
                <p className="mt-3 whitespace-pre-line">
                  {e.response || <span className="text-grey-tint1">(blank)</span>}
                </p>
              </details>
            ))
          )}
          <p className="mt-3 text-xs">
            <strong>Communication</strong> includes a rating of these answers.
          </p>
        </section>
      </div>

      <InterviewForm data={data} />
    </>
  );
}
