"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { submitParentForm } from "@/app/parent/parent-actions";
import type { ParentFormData } from "@/utils/parent-form";
import {
  AVAILABILITY_OPTIONS,
  IEP_OPTIONS,
  WANTS_INFO_OPTIONS,
  type ParentFormState,
} from "@/utils/parent-options";
import {
  ActionButton,
  Alert,
  RadioGroup,
  TextField,
  Textarea,
} from "@/components/forms";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/parent/signature-pad";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-9 border-b border-grey-tint2 pb-1 text-lg font-bold first:mt-0">
      {children}
    </h2>
  );
}

/** Shown after a successful submit, and by the page when a link is revisited. */
export function ParentFormComplete({
  studentFirstName,
  contactEmail,
}: {
  studentFirstName: string;
  contactEmail: string;
}) {
  return (
    <div className="rounded-lg border border-green-dark bg-green-tint3 p-6">
      <h1 className="mb-3 text-2xl font-bold">Thank you — you&apos;re done</h1>
      <p className="mb-3">
        We&apos;ve received and recorded your signed parent/guardian form for{" "}
        {studentFirstName}. This step of their application is now complete —
        there&apos;s nothing else you need to do.
      </p>
      <p className="text-xs">
        Questions? Email{" "}
        <a className="text-teal-dark underline" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>
        .
      </p>
    </div>
  );
}

export function ParentForm({
  token,
  data,
}: {
  token: string;
  data: ParentFormData;
}) {
  const [state, action] = useActionState<ParentFormState, FormData>(
    submitParentForm.bind(null, token),
    {},
  );
  const err = state.errors;

  const [wantsInfo, setWantsInfo] = useState("");
  const [availability, setAvailability] = useState("");
  const [signatureError, setSignatureError] = useState<string | undefined>();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const onReady = useCallback((handle: SignaturePadHandle | null) => {
    padRef.current = handle;
  }, []);

  const prefill = data.guardianPrefill;
  const needsConcerns = availability === "no" || availability === "not_sure";

  if (state.submitted) {
    return (
      <ParentFormComplete
        studentFirstName={data.studentFirstName}
        contactEmail={data.contactEmail}
      />
    );
  }

  const availabilityLegend = `As far as you know, is your student available to attend Launchpad for 6 weeks this summer${
    data.summerDates ? ` (${data.summerDates})` : ""
  }${data.summerLocation ? ` at ${data.summerLocation}` : ""}?`;

  // Runs before the server action. If the canvas is empty but a name is typed,
  // render that name as the signature image (the accessible path) rather than
  // blocking submission on a drawing.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const pad = padRef.current;
    if (!pad || !pad.isEmpty()) {
      setSignatureError(undefined);
      return;
    }
    const typed = (
      form.elements.namedItem("signature_typed_name") as HTMLInputElement | null
    )?.value?.trim();
    if (typed && pad.renderTypedName(typed)) {
      setSignatureError(undefined);
      return;
    }
    event.preventDefault();
    setSignatureError(
      "Draw your signature above, or type your full legal name below.",
    );
  };

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Parent / Guardian Form</h1>
      <p className="mb-6">
        Your student, {data.studentName}, has applied to Launchpad Philly. This
        short form is the parent/guardian part of their application — you
        don&apos;t need an account, and it should take about five minutes.
      </p>

      {err?.form && <Alert tone="error">{err.form}</Alert>}
      {err && !err.form && (
        <Alert tone="error">
          Please fix the highlighted fields below, then submit again.
        </Alert>
      )}

      <form action={action} onSubmit={handleSubmit} noValidate>
        <SectionHeading>About Launchpad</SectionHeading>
        <RadioGroup
          legend="Before we get started, do you want to learn a bit more about Launchpad?"
          name="wants_program_info"
          options={WANTS_INFO_OPTIONS}
          optional
          onChange={setWantsInfo}
        />
        {wantsInfo === "yes" && data.programInfo && (
          <div className="mb-6 rounded-lg border border-teal-dark bg-teal-tint3 p-6">
            <p className="whitespace-pre-line">{data.programInfo}</p>
          </div>
        )}

        <SectionHeading>Your student</SectionHeading>
        <TextField
          label="Student name"
          name="student_name_display"
          defaultValue={data.studentName}
          readOnly
          hint="Filled in from your student's application."
        />
        <TextField
          label="Student date of birth"
          name="student_dob_display"
          defaultValue={data.dateOfBirth}
          readOnly
        />
        <TextField
          label="Student high school"
          name="student_school_display"
          defaultValue={data.schoolName}
          readOnly
        />

        <SectionHeading>Availability &amp; support</SectionHeading>
        <RadioGroup
          legend={availabilityLegend}
          name="availability"
          options={AVAILABILITY_OPTIONS}
          error={err?.availability}
          onChange={setAvailability}
        />
        {needsConcerns && (
          <Textarea
            label="Please share what conflicts or concerns you have with the summer schedule"
            name="availability_concerns"
            error={err?.availability_concerns}
          />
        )}
        <RadioGroup
          legend="Does your student have an IEP?"
          name="iep"
          options={IEP_OPTIONS}
          optional
        />
        <Textarea
          label="Is there anything you want us to know as we consider your student's application?"
          name="comments"
          optional
        />

        <SectionHeading>Your contact information</SectionHeading>
        <TextField
          label="Your first name"
          name="parent_first_name"
          defaultValue={prefill?.first_name}
          autoComplete="given-name"
          error={err?.parent_first_name}
        />
        <TextField
          label="Your last name"
          name="parent_last_name"
          defaultValue={prefill?.last_name}
          autoComplete="family-name"
          error={err?.parent_last_name}
        />
        <TextField
          label="Your relationship to the student"
          name="parent_relationship"
          defaultValue={prefill?.relationship}
          hint="For example: mother, father, uncle, grandmother, caregiver."
          error={err?.parent_relationship}
        />
        <TextField
          label="Best email for updates"
          name="parent_email"
          type="email"
          defaultValue={prefill?.email}
          autoComplete="email"
          error={err?.parent_email}
        />
        <TextField
          label="Best phone number to call or text"
          name="parent_phone"
          type="tel"
          defaultValue={prefill?.phone}
          autoComplete="tel"
          error={err?.parent_phone}
        />

        <SectionHeading>Records release &amp; signature</SectionHeading>
        <div className="mb-6 rounded-lg border border-grey-tint2 bg-grey-tint4 p-6">
          <p className="whitespace-pre-line">{data.consentText}</p>
        </div>
        <SignaturePad
          name="signature_data_url"
          error={signatureError ?? err?.signature_data_url}
          onReady={onReady}
        />
        <TextField
          label="Type your full legal name"
          name="signature_typed_name"
          autoComplete="name"
          hint="Typing your name here confirms you agree to the statement above."
          error={err?.signature_typed_name}
        />

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ActionButton pendingLabel="Submitting…">
            Submit signed form
          </ActionButton>
        </div>
      </form>

      <p className="mt-6 text-xs">
        Questions about this form? Email{" "}
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
