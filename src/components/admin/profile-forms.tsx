"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updateStudentInfo,
  updateGuardian,
  regenerateParentLinkAsAdmin,
  addNote,
  type AdminFormState,
} from "@/app/(admin)/admin/applicants/[id]/actions";
import {
  uploadDocument,
  deleteDocument,
} from "@/app/(admin)/admin/applicants/[id]/document-actions";
import { DOC_TYPES } from "@/utils/document-options";
import type { ApplicantProfile } from "@/utils/applicant-profile";
import { Alert, TextField, SubmitButton } from "@/components/forms";

export function StudentInfoForm({ profile }: { profile: ApplicantProfile }) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    updateStudentInfo.bind(null, profile.applicationId, profile.studentId),
    {},
  );
  const s = profile.student;
  return (
    <form action={action}>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-x-6 sm:grid-cols-2">
        <TextField label="First name" name="first_name" defaultValue={s.firstName} />
        <TextField label="Last name" name="last_name" defaultValue={s.lastName} />
        <TextField
          label="Preferred name"
          name="preferred_name"
          defaultValue={s.preferredName ?? ""}
          optional
        />
        <TextField label="Phone" name="phone" type="tel" defaultValue={s.phone ?? ""} />
      </div>
      <p className="mb-6 text-xs">
        Email ({s.email}) is the student&apos;s login — they change it from
        their own profile, so it isn&apos;t editable here.
      </p>
      <SubmitButton pendingLabel="Saving…">Save student details</SubmitButton>
    </form>
  );
}

export function GuardianForm({
  applicationId,
  guardian,
}: {
  applicationId: string;
  guardian: ApplicantProfile["guardians"][number];
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    updateGuardian.bind(null, applicationId, guardian.id),
    {},
  );
  return (
    <form action={action} className="border-t border-grey-tint3 pt-6 first:border-0 first:pt-0">
      <h3 className="mb-3 font-bold">Guardian {guardian.position}</h3>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-x-6 sm:grid-cols-2">
        <TextField label="First name" name="first_name" defaultValue={guardian.firstName} />
        <TextField label="Last name" name="last_name" defaultValue={guardian.lastName} />
        <TextField label="Email" name="email" type="email" defaultValue={guardian.email} />
        <TextField label="Phone" name="phone" type="tel" defaultValue={guardian.phone} />
        <TextField
          label="Relationship"
          name="relationship"
          defaultValue={guardian.relationship}
        />
      </div>
      <SubmitButton pendingLabel="Saving…">Save guardian {guardian.position}</SubmitButton>
    </form>
  );
}

export function ParentLinkPanel({
  applicationId,
  url,
  submitted,
}: {
  applicationId: string;
  url: string;
  submitted: boolean;
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    async () => regenerateParentLinkAsAdmin(applicationId),
    {},
  );
  return (
    <>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <p className="mb-3 text-xs">
        {submitted
          ? "The parent form is already signed and submitted. A new link would let them fill it in again — only regenerate if you know you need that."
          : "Send this to the parent or guardian if they never got it, or if it went to the wrong address."}
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Parent form link"
        className="mb-3 w-full rounded-md border border-grey-tint1 bg-grey-tint4 px-3 py-3 text-xs"
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs font-bold
            text-teal-dark hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
            focus-visible:ring-teal-dark"
        >
          Copy link
        </button>
        <form action={action}>
          <button
            type="submit"
            className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs font-bold
              text-orange-dark hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark"
          >
            Generate a new link
          </button>
        </form>
      </div>
    </>
  );
}

export function DocumentPanel({ profile }: { profile: ApplicantProfile }) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    uploadDocument.bind(null, profile.applicationId),
    {},
  );
  return (
    <>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      {profile.documents.length > 0 && (
        <ul className="mb-6 space-y-3">
          {profile.documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-grey-tint2 px-3 py-3"
            >
              <span>
                <Link
                  className="font-bold text-teal-dark underline"
                  href={`/admin/documents?path=${encodeURIComponent(doc.storagePath)}`}
                  prefetch={false}
                >
                  {doc.fileName}
                </Link>
                <span className="block text-xs">
                  {DOC_TYPES.find((d) => d.value === doc.docType)?.label ?? doc.docType}
                  {" · "}
                  {new Date(doc.createdAt).toLocaleDateString("en-US")}
                </span>
              </span>
              <DeleteDocumentButton
                applicationId={profile.applicationId}
                documentId={doc.id}
              />
            </li>
          ))}
        </ul>
      )}

      <form action={action}>
        <label className="block font-bold" htmlFor="doc_type">
          Document type
        </label>
        <select
          id="doc_type"
          name="doc_type"
          defaultValue="transcript"
          className="mb-6 mt-1 block w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
        >
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <label className="block font-bold" htmlFor="file">
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.heic"
          className="mb-6 mt-1 block w-full text-base"
        />
        <SubmitButton pendingLabel="Uploading…">Upload document</SubmitButton>
      </form>
    </>
  );
}

function DeleteDocumentButton({
  applicationId,
  documentId,
}: {
  applicationId: string;
  documentId: string;
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    async () => deleteDocument(applicationId, documentId),
    {},
  );
  return (
    <form action={action}>
      <button
        type="submit"
        className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs font-bold
          text-orange-dark hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
          focus-visible:ring-teal-dark"
      >
        Remove
      </button>
      {state.error && <span className="ml-3 text-xs text-orange-dark">{state.error}</span>}
    </form>
  );
}

export function NotesPanel({ profile }: { profile: ApplicantProfile }) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    addNote.bind(null, profile.applicationId),
    {},
  );
  return (
    <>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      <form action={action} className="mb-6">
        <label className="block font-bold" htmlFor="body">
          Add a note
        </label>
        <textarea
          id="body"
          name="body"
          rows={3}
          className="mb-3 mt-1 block w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
        />
        <SubmitButton pendingLabel="Saving…">Add note</SubmitButton>
      </form>

      {profile.notes.length === 0 ? (
        <p className="text-xs">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {profile.notes.map((note) => (
            <li key={note.id} className="rounded-md border border-grey-tint2 px-3 py-3">
              <p className="whitespace-pre-line">{note.body}</p>
              <p className="mt-1 text-xs text-grey-tint1">
                {note.authorEmail} · {new Date(note.createdAt).toLocaleString("en-US")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
