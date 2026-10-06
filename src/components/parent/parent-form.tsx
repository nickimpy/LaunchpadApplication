"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { submitParentForm } from "@/app/parent/parent-actions";
import type { ParentFormData } from "@/utils/parent-form";
import {
  AVAILABILITY_OPTIONS,
  IEP_OPTIONS,
  SELF_RELATIONSHIP,
  WANTS_INFO_OPTIONS,
  type ParentFormState,
} from "@/utils/parent-options";
import {
  ActionButton,
  Alert,
  useStatusFocus,
  RadioGroup,
  TextField,
  Textarea,
} from "@/components/forms";
import { RichText } from "@/components/rich-text";
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
  selfRelease = false,
}: {
  studentFirstName: string;
  contactEmail: string;
  selfRelease?: boolean;
}) {
  return (
    <div className="rounded-lg border border-green-dark bg-green-tint3 p-6">
      <h1 className="mb-3 text-2xl font-bold">Thank you — you&apos;re done</h1>
      {selfRelease ? (
        <>
          <p className="mb-3">
            We&apos;ve received and recorded your signed records release form.
            This step of your application is now complete — there&apos;s nothing
            else you need to do here.
          </p>
          <p className="mb-3">
            <Link className="font-bold text-teal-dark underline" href="/portal">
              Back to your application
            </Link>
          </p>
        </>
      ) : (
        <p className="mb-3">
          We&apos;ve received and recorded your signed parent/guardian form for{" "}
          {studentFirstName}. This step of their application is now complete —
          there&apos;s nothing else you need to do.
        </p>
      )}
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
  // Parents reach the bottom of this form before submitting, so the result —
  // errors, or the thank-you panel — has to come to them.
  const statusRef = useStatusFocus(state);

  const [wantsInfo, setWantsInfo] = useState("");
  const [availability, setAvailability] = useState("");
  const [signatureError, setSignatureError] = useState<string | undefined>();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const onReady = useCallback((handle: SignaturePadHandle | null) => {
    padRef.current = handle;
  }, []);

  // Answers echoed back by the action win over the guardian prefill: React 19
  // resets uncontrolled fields once the action returns, so these are what keeps
  // a parent's typing on screen when one field fails validation.
  const prior = state.values;
  const prefill = data.guardianPrefill;
  const dv = {
    wants_program_info: prior?.wants_program_info ?? "",
    availability: prior?.availability ?? "",
    availability_concerns: prior?.availability_concerns ?? "",
    iep: prior?.iep ?? "",
    comments: prior?.comments ?? "",
    parent_first_name: prior?.parent_first_name ?? prefill?.first_name ?? "",
    parent_last_name: prior?.parent_last_name ?? prefill?.last_name ?? "",
    parent_relationship:
      prior?.parent_relationship ?? prefill?.relationship ?? "",
    parent_email: prior?.parent_email ?? prefill?.email ?? "",
    parent_phone: prior?.parent_phone ?? prefill?.phone ?? "",
    signature_typed_name: prior?.signature_typed_name ?? "",
  };

  const needsConcerns = availability === "no" || availability === "not_sure";
  // 18+ applicant signing their own release: same form, student as the signer.
  const self = data.selfRelease;

  if (state.submitted) {
    return (
      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        <ParentFormComplete
          studentFirstName={data.studentFirstName}
          contactEmail={data.contactEmail}
        />
      </div>
    );
  }

  const when = `${data.summerDates ? ` (${data.summerDates})` : ""}${
    data.summerLocation ? ` at ${data.summerLocation}` : ""
  }`;
  const availabilityLegend = self
    ? `Are you available to attend Launchpad for 6 weeks this summer${when}?`
    : `As far as you know, is your student available to attend Launchpad for 6 weeks this summer${when}?`;

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
      <h1 className="mb-3 text-2xl font-bold">
        {self ? "Records Release Form" : "Parent / Guardian Form"}
      </h1>
      {self ? (
        <p className="mb-6">
          You&apos;re 18 or older, so you can authorize the release of your own
          school records. This short form is part of your application to
          Launchpad Philly — it should take about five minutes.
        </p>
      ) : (
        <p className="mb-6">
          Your student, {data.studentName}, has applied to Launchpad Philly.
          This short form is the parent/guardian part of their application —
          you don&apos;t need an account, and it should take about five
          minutes.
        </p>
      )}

      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {err?.form && <Alert tone="error">{err.form}</Alert>}
        {err && !err.form && (
          <Alert tone="error">
            Please fix the highlighted fields below, then submit again.
          </Alert>
        )}
      </div>

      <form action={action} onSubmit={handleSubmit} noValidate>
        {!self && (
          <>
            <SectionHeading>About Launchpad</SectionHeading>
            <RadioGroup
              legend="Before we get started, do you want to learn a bit more about Launchpad?"
              name="wants_program_info"
              options={WANTS_INFO_OPTIONS}
              defaultValue={dv.wants_program_info}
              optional
              onChange={setWantsInfo}
            />
            {wantsInfo === "yes" && data.programInfo && (
              <div className="mb-6 rounded-lg border border-teal-dark bg-teal-tint3 p-6">
                <RichText text={data.programInfo} />
              </div>
            )}
          </>
        )}

        <SectionHeading>{self ? "Your information" : "Your student"}</SectionHeading>
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
        <p className="-mt-3 mb-6 text-xs">
          See something wrong here? Email{" "}
          <a
            className="font-bold text-teal-dark underline"
            href={`mailto:${data.contactEmail}`}
          >
            {data.contactEmail}
          </a>{" "}
          and we&apos;ll get it fixed, or{" "}
          {self ? "edit your application" : "instruct your student to edit their application"}.
        </p>

        <SectionHeading>Availability &amp; support</SectionHeading>
        <RadioGroup
          legend={availabilityLegend}
          name="availability"
          options={AVAILABILITY_OPTIONS}
          defaultValue={dv.availability}
          error={err?.availability}
          onChange={setAvailability}
        />
        {needsConcerns && (
          <Textarea
            label="Please share what conflicts or concerns you have with the summer schedule"
            name="availability_concerns"
            defaultValue={dv.availability_concerns}
            error={err?.availability_concerns}
          />
        )}
        <RadioGroup
          legend={self ? "Do you have an IEP?" : "Does your student have an IEP?"}
          name="iep"
          options={IEP_OPTIONS}
          defaultValue={dv.iep}
          error={err?.iep}
        />
        <Textarea
          label={
            self
              ? "Is there anything you want us to know as we consider your application?"
              : "Is there anything you want us to know as we consider your student's application?"
          }
          name="comments"
          defaultValue={dv.comments}
          optional
        />

        <SectionHeading>Your contact information</SectionHeading>
        <TextField
          label="Your first name"
          name="parent_first_name"
          defaultValue={dv.parent_first_name}
          autoComplete="given-name"
          error={err?.parent_first_name}
        />
        <TextField
          label="Your last name"
          name="parent_last_name"
          defaultValue={dv.parent_last_name}
          autoComplete="family-name"
          error={err?.parent_last_name}
        />
        {self ? (
          // The server sets this itself for a self-signed release; the field
          // only exists so the submitted form stays shaped like any other.
          <input type="hidden" name="parent_relationship" value={SELF_RELATIONSHIP} />
        ) : (
          <TextField
            label="Your relationship to the student"
            name="parent_relationship"
            defaultValue={dv.parent_relationship}
            hint="For example: mother, father, uncle, grandmother, caregiver."
            error={err?.parent_relationship}
          />
        )}
        <TextField
          label="Best email for updates"
          name="parent_email"
          type="email"
          defaultValue={dv.parent_email}
          autoComplete="email"
          error={err?.parent_email}
        />
        <TextField
          label="Best phone number to call or text"
          name="parent_phone"
          type="tel"
          defaultValue={dv.parent_phone}
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
          defaultValue={dv.signature_typed_name}
          autoComplete="name"
          hint="Typing your name here confirms you agree to the statement above."
          error={err?.signature_typed_name}
        />

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ActionButton pendingLabel="Submitting…">
            {self ? "Sign and submit" : "Submit signed form"}
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
