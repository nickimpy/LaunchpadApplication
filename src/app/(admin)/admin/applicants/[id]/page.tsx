import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApplicantProfile } from "@/utils/applicant-profile";
import { formatDateTime } from "@/utils/dates";
import { STEPS, STATUS_LABELS, type StepStatus } from "@/utils/steps";
import {
  StudentInfoForm,
  GuardianForm,
  ParentLinkPanel,
  DocumentPanel,
  NotesPanel,
} from "@/components/admin/profile-forms";
import {
  C2LVerifyRow,
  DecisionPanel,
  InterviewSummary,
} from "@/components/admin/staff-step-forms";

export const metadata: Metadata = { title: "Applicant — Launchpad Admin" };

type Params = Promise<{ id: string }>;

const BADGE: Record<StepStatus, string> = {
  not_started: "bg-grey-tint3 text-grey",
  in_progress: "bg-teal-tint3 text-teal-dark",
  submitted: "bg-teal-dark text-white",
  pending_verification: "bg-orange-tint3 text-orange-dark",
  complete: "bg-green-tint3 text-green-dark",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text =
    value === null || value === undefined || value === ""
      ? "—"
      : Array.isArray(value)
        ? value.join(", ")
        : String(value);
  return (
    <div className="mb-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-grey-tint1">
        {label}
      </dt>
      <dd className="whitespace-pre-line">{text}</dd>
    </div>
  );
}

export default async function ApplicantProfilePage({ params }: { params: Params }) {
  const profile = await getApplicantProfile((await params).id);
  if (!profile) notFound();

  const app = profile.application;
  const s = profile.student;
  const parentSubmitted = Boolean(profile.parentForm);

  return (
    <>
      <p className="mb-3 text-xs">
        <Link className="text-teal-dark underline" href="/admin/applicants">
          ← All applicants
        </Link>
      </p>

      <h1 className="text-2xl font-bold">
        {s.firstName} {s.lastName}
        {s.preferredName && (
          <span className="ml-3 text-lg font-normal">(goes by {s.preferredName})</span>
        )}
      </h1>
      <p className="mb-6 text-xs">
        {s.email}
        {s.phone ? ` · ${s.phone}` : ""} · {profile.schoolName || "No school on file"}
        {profile.isPartnerSchool && " · Partner school (Track A)"}
      </p>

      {Boolean(app.college_warning_flagged) && (
        <div className="mb-6 rounded-md border-l-4 border-orange-dark bg-orange-tint3 px-3 py-3">
          <strong>Flagged for review:</strong> this student chose a
          post-high-school plan that may not be compatible with Launchpad
          (college outside Philadelphia).
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        {STEPS.map((step) => {
          const status = profile.statuses[step.number] ?? "not_started";
          return (
            <span
              key={step.number}
              className={`rounded-full px-3 py-1 text-xs font-bold ${BADGE[status]}`}
            >
              {step.number}. {step.name}: {STATUS_LABELS[status]}
            </span>
          );
        })}
      </div>

      {/* Staff work happens here — documents to upload, notes to leave, and a
          record of who changed what — so it leads rather than sitting below
          the application detail. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Documents">
          <DocumentPanel profile={profile} />
        </Card>

        <Card title="Staff notes">
          <NotesPanel profile={profile} />
        </Card>

        <Card title="Activity log">
          {profile.audit.length === 0 ? (
            <p className="text-xs">No staff changes recorded yet.</p>
          ) : (
            <ul className="space-y-3 text-xs">
              {profile.audit.map((a) => (
                <li key={a.id}>
                  <span className="font-bold">{a.action}</span> ·{" "}
                  {a.actorEmail ?? "unknown"} · {formatDateTime(a.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* The staff-owned steps: interview (4), C2L verification (5 and 6), and
          the decision (7). These are the actions a reviewer opens a profile to
          take, so they sit above the read-only application detail. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Interview (Step 4)">
          <InterviewSummary
            applicationId={profile.applicationId}
            recorded={profile.interview.recorded}
            interviewDate={profile.interview.interviewDate}
            finalRating={profile.interview.finalRating}
            interviewers={profile.interview.interviewers}
          />
        </Card>

        <Card title="C2LPHL verification (Steps 5–6)">
          <p className="mb-3 text-xs">
            The student self-reports; staff confirm against C2LPHL&apos;s
            reports. Only staff can mark these complete.
          </p>
          <C2LVerifyRow
            applicationId={profile.applicationId}
            stepNumber={5}
            stepName="C2LPHL Application"
            status={profile.statuses[5] ?? "not_started"}
          />
          <C2LVerifyRow
            applicationId={profile.applicationId}
            stepNumber={6}
            stepName="C2LPHL Required Documents"
            status={profile.statuses[6] ?? "not_started"}
          />
        </Card>

        <Card title="Admissions decision (Step 7)">
          <DecisionPanel
            applicationId={profile.applicationId}
            status={profile.decision.status}
            notes={profile.decision.notes}
            decidedAt={profile.decision.decidedAt}
            releasedAt={profile.decision.releasedAt}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Card title="Student details">
            <StudentInfoForm profile={profile} />
          </Card>

          <Card title="Application (Step 1)">
            <dl>
              <Field label="Date of birth" value={s.dateOfBirth} />
              <Field label="Notification preference" value={s.notificationPreference} />
              <Field
                label="Address"
                value={[app.street, app.street_2, app.city, app.state, app.zip]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Field label="School" value={profile.schoolName} />
              <Field label="GPA" value={app.gpa} />
              <Field label="Graduation year" value={app.graduation_year} />
              <Field label="Program" value={app.program} />
              <Field label="Interview track" value={app.track} />
              <Field label="Heard about Launchpad via" value={app.referral_source} />
            </dl>

            {app.program_answers != null &&
              Object.keys(app.program_answers as object).length > 0 && (
                <>
                  <h3 className="mb-3 mt-6 font-bold">Program questions</h3>
                  <dl>
                    {Object.entries(app.program_answers as Record<string, unknown>).map(
                      ([key, value]) => (
                        <Field key={key} label={key.replace(/^(ls|fnd)_/, "").replace(/_/g, " ")} value={value} />
                      ),
                    )}
                  </dl>
                </>
              )}
          </Card>

          <Card title="Short answers (Step 3)">
            {profile.essays.length === 0 ? (
              <p className="text-xs">Nothing submitted yet.</p>
            ) : (
              profile.essays.map((e) => (
                <div key={e.prompt} className="mb-6">
                  <h3 className="mb-1 font-bold">{e.prompt}</h3>
                  <p className="whitespace-pre-line">
                    {e.response || <span className="text-grey-tint1">(blank)</span>}
                  </p>
                </div>
              ))
            )}
          </Card>

          <Card title="Demographics (funder reporting only)">
            <p className="mb-6 text-xs">
              Collected for funder reporting. Per the PRD this never affects
              admissions decisions.
            </p>
            {profile.demographics ? (
              <dl>
                {Object.entries(profile.demographics)
                  .filter(([k]) => !["id", "application_id", "created_at", "updated_at"].includes(k))
                  .map(([key, value]) => (
                    <Field key={key} label={key.replace(/_/g, " ")} value={value} />
                  ))}
              </dl>
            ) : (
              <p className="text-xs">Nothing submitted yet.</p>
            )}
          </Card>
        </div>

        <div>
          <Card title="Parent / guardian form (Step 2)">
            {parentSubmitted ? (
              <>
                <dl>
                  {Object.entries(profile.parentForm as Record<string, unknown>)
                    .filter(
                      ([k]) =>
                        !["id", "application_id", "signature_image_path", "consent_text_snapshot"].includes(k),
                    )
                    .map(([key, value]) => (
                      <Field key={key} label={key.replace(/_/g, " ")} value={value} />
                    ))}
                </dl>
                <div className="mt-6 flex flex-wrap items-center gap-6">
                  {/* The document schools ask for before releasing a
                      transcript — signature, consent text, and identifiers
                      in one printable page. */}
                  <a
                    className="rounded-md bg-teal-dark px-3 py-3 text-base font-bold text-white
                      hover:brightness-110 focus:outline-none focus-visible:ring-2
                      focus-visible:ring-teal-dark focus-visible:ring-offset-2"
                    href={`/admin/applicants/${profile.applicationId}/release`}
                  >
                    Download records release (PDF)
                  </a>
                  <Link
                    className="text-xs font-bold text-teal-dark underline"
                    href={`/admin/documents?bucket=signatures&path=${encodeURIComponent(
                      String((profile.parentForm as Record<string, unknown>).signature_image_path),
                    )}`}
                    prefetch={false}
                  >
                    View signature image
                  </Link>
                </div>
                <details className="mt-6">
                  <summary className="cursor-pointer text-xs font-bold">
                    Consent text they agreed to
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-xs">
                    {String(
                      (profile.parentForm as Record<string, unknown>).consent_text_snapshot,
                    )}
                  </p>
                </details>
              </>
            ) : (
              <p className="mb-6 text-xs">Not submitted yet.</p>
            )}
          </Card>

          <Card title="Parent link">
            <ParentLinkPanel
              applicationId={profile.applicationId}
              url={profile.parentLinkUrl}
              submitted={parentSubmitted}
            />
          </Card>

          <Card title="Guardian contacts">
            {profile.guardians.length === 0 ? (
              <p className="text-xs">No guardians on file yet.</p>
            ) : (
              profile.guardians.map((g) => (
                <GuardianForm
                  key={g.id}
                  applicationId={profile.applicationId}
                  guardian={g}
                />
              ))
            )}
          </Card>

        </div>
      </div>
    </>
  );
}
