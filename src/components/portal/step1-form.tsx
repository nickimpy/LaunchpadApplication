"use client";

import { useActionState, useState } from "react";
import { saveStep1 } from "@/app/(portal)/portal/steps/step1-actions";
import type { Step1Data } from "@/utils/step1";
import { ParentLinkBox, SelfReleaseBox } from "@/components/portal/parent-link-box";
import {
  Alert,
  ActionButton,
  useStatusFocus,
  CheckboxGroup,
  RadioGroup,
  SelectField,
  TextField,
} from "@/components/forms";
import { GPA_MAX, GPA_MIN } from "@/utils/validation";
import {
  SCHOOL_OTHER,
  type Step1State,
  GRADUATION_YEARS,
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  RACE_OPTIONS,
  HOUSEHOLD_INCOME_OPTIONS,
  PARENT_COLLEGE_OPTIONS,
  PATHWAYS,
  FND_PATHWAY_OPTIONS,
  FND_POST_HS_OPTIONS,
  RELEASE_SIGNER_OPTIONS,
  needsCollegeWarning,
} from "@/utils/step1-options";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-9 border-b border-grey-tint2 pb-1 text-lg font-bold first:mt-0">
      {children}
    </h2>
  );
}

export function Step1Form({ data }: { data: Step1Data }) {
  const [state, action] = useActionState<Step1State, FormData>(saveStep1, {});
  const err = state.errors;
  // Prefer the answers echoed back by the action: React 19 resets uncontrolled
  // fields after a form action, so on a validation error these are what keeps
  // the student's typing on screen instead of blanking the whole form.
  const values = state.values ?? data.values;
  // After a submit you're usually at the bottom of this long form; pull the
  // result banner into view (and announce it) instead of leaving it unseen.
  const statusRef = useStatusFocus(state);

  const [gradYear, setGradYear] = useState(values.graduation_year);
  const [gender, setGender] = useState(values.gender);
  const [pronouns, setPronouns] = useState(values.pronouns);
  const [race, setRace] = useState<string[]>(values.race_ethnicity);
  const [schoolChoice, setSchoolChoice] = useState(
    values.school_id ? values.school_id : values.school_other ? SCHOOL_OTHER : "",
  );
  const [hasGuardian2, setHasGuardian2] = useState(values.has_guardian2);
  const [postHsPlan, setPostHsPlan] = useState(
    values.program_answers.fnd_post_hs_plan ?? "",
  );
  const [signer, setSigner] = useState(values.self_release || "no");

  // 18+ applicants may authorize the release of their own records; then the
  // parent/guardian section becomes an optional emergency contact.
  const selfRelease = data.isAdult && signer === "yes";
  const showCollegeWarning = needsCollegeWarning(gradYear, postHsPlan);
  const contactWho = selfRelease ? "Emergency contact's" : "Guardian's";

  const schoolOptions = [
    ...data.schools.map((s) => ({ value: s.id, label: s.name })),
    { value: SCHOOL_OTHER, label: "Other" },
  ];

  const pa = values.program_answers;

  return (
    <>
      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {state.success && <Alert tone="success">{state.success}</Alert>}
        {err?.form && <Alert tone="error">{err.form}</Alert>}
        {err && !err.form && (
          <Alert tone="error">
            Please fix the highlighted fields below, then submit again.
          </Alert>
        )}
      </div>
      {data.parentLinkUrl &&
        (data.isAdult && values.self_release === "yes" ? (
          <SelfReleaseBox url={data.parentLinkUrl} />
        ) : (
          <ParentLinkBox url={data.parentLinkUrl} />
        ))}

      <form action={action} noValidate>
        {/* ---- Personal ---- */}
        <SectionHeading>Personal information</SectionHeading>
        <p className="mb-6 text-xs">
          Use your full legal name here — it appears on official documents.
          You&apos;ll tell us your preferred name separately.
        </p>
        <TextField label="Legal first name" name="first_name" autoComplete="given-name"
          defaultValue={values.first_name} error={err?.first_name} />
        <TextField label="Legal last name" name="last_name" autoComplete="family-name"
          defaultValue={values.last_name} error={err?.last_name} />
        <TextField label="Preferred name" name="preferred_name" optional
          hint="What you'd like us to call you in messages."
          defaultValue={values.preferred_name} error={err?.preferred_name} />
        {/* Email is the account login; managed in Profile, read-only here
            (the action ignores it). */}
        <TextField label="Email" name="email" type="email" readOnly
          defaultValue={values.email}
          hint="This is your account email. To change it, go to your Profile." />
        <TextField label="Phone number" name="phone" type="tel" autoComplete="tel"
          defaultValue={values.phone} error={err?.phone} />
        <TextField label="Street address" name="street" autoComplete="address-line1"
          defaultValue={values.street} error={err?.street} />
        <TextField label="Street address line 2" name="street_2" optional
          autoComplete="address-line2" defaultValue={values.street_2}
          error={err?.street_2} />
        <TextField label="City" name="city" autoComplete="address-level2"
          defaultValue={values.city} error={err?.city} />
        <TextField label="State" name="state" autoComplete="address-level1"
          defaultValue={values.state} error={err?.state} />
        <TextField label="ZIP code" name="zip" autoComplete="postal-code"
          defaultValue={values.zip} error={err?.zip} />

        {/* ---- Academic ---- */}
        <SectionHeading>Academic information</SectionHeading>
        <SelectField label="What school do you attend?" name="school_id"
          options={schoolOptions} defaultValue={schoolChoice}
          onChange={setSchoolChoice} error={err?.school_id} />
        {schoolChoice === SCHOOL_OTHER && (
          <TextField label="What high school do you attend?" name="school_other"
            defaultValue={values.school_other} error={err?.school_other} />
        )}
        <TextField label="Cumulative (weighted) GPA" name="gpa" type="number"
          inputMode="decimal" min={GPA_MIN} max={GPA_MAX} step="any"
          defaultValue={values.gpa} error={err?.gpa}
          hint={`Your cumulative weighted GPA, for example 3.5. Enter a number from ${GPA_MIN} to ${GPA_MAX}.`} />
        <SelectField label="Graduation year" name="graduation_year"
          options={GRADUATION_YEARS} defaultValue={values.graduation_year}
          onChange={setGradYear} error={err?.graduation_year}
          hint="Students graduating in 2029 or later are not currently eligible to apply." />
        <TextField label="How did you hear about Launchpad?" name="referral_source"
          optional defaultValue={values.referral_source} error={err?.referral_source} />

        {/* ---- Pathway ---- */}
        <SectionHeading>Pathway interest</SectionHeading>
        <p className="mb-6">
          You&apos;re applying to{" "}
          <span className="font-bold">Launchpad Foundations</span>. Launchpad
          has two pathways — here&apos;s what each one covers.
        </p>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {PATHWAYS.map((p) => (
            <div
              key={p.name}
              className="rounded-lg border border-teal-dark bg-teal-tint3 p-6"
            >
              <h3 className="mb-3 text-lg font-bold">{p.name}</h3>
              <ul className="list-disc space-y-3 pl-6">
                {p.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <RadioGroup legend="Currently, what pathway are you most interested in?"
          name="fnd_pathway" options={FND_PATHWAY_OPTIONS}
          defaultValue={pa.fnd_pathway} error={err?.fnd_pathway} />
        <RadioGroup legend="What are your current plans for after high school?"
          name="fnd_post_hs_plan" options={FND_POST_HS_OPTIONS}
          defaultValue={pa.fnd_post_hs_plan} onChange={setPostHsPlan}
          error={err?.fnd_post_hs_plan} />
        {showCollegeWarning && (
          <Alert tone="info">
            <span className="font-bold">A quick heads-up:</span> Launchpad is a
            half-day program based in Center City Philadelphia. It does not fit
            with a full-time college schedule. You will be asked to report to
            801 Market Street 4 days/week next school year. You can still
            continue — your application will be flagged so our team can talk it
            through with you. Questions? Email{" "}
            <a className="font-bold underline" href={`mailto:${data.contactEmail}`}>
              {data.contactEmail}
            </a>
          </Alert>
        )}

        {/* ---- Demographic ---- */}
        <SectionHeading>Demographic information</SectionHeading>
        <p className="mb-6 text-xs">
          We collect this only for grant and funder reporting. It never affects
          your application or admissions decision.
        </p>
        <SelectField label="Gender identity" name="gender" options={GENDER_OPTIONS}
          defaultValue={values.gender} onChange={setGender} error={err?.gender} />
        {gender === "Other" && (
          <TextField label="Please describe your gender identity" name="gender_other"
            defaultValue={values.gender_other} error={err?.gender_other} />
        )}
        <SelectField label="Preferred pronouns" name="pronouns" options={PRONOUN_OPTIONS}
          defaultValue={values.pronouns} onChange={setPronouns} error={err?.pronouns} />
        {pronouns === "Other" && (
          <TextField label="Please share your pronouns" name="pronouns_other"
            defaultValue={values.pronouns_other} error={err?.pronouns_other} />
        )}
        <CheckboxGroup legend="Race / ethnicity (check all that apply)"
          name="race_ethnicity" options={RACE_OPTIONS}
          defaultValues={values.race_ethnicity} onChange={setRace}
          error={err?.race_ethnicity} />
        {race.includes("Other") && (
          <TextField label="Please describe your race/ethnicity"
            name="race_ethnicity_other" defaultValue={values.race_ethnicity_other}
            error={err?.race_ethnicity_other} />
        )}
        <SelectField label="Combined household income" name="household_income"
          options={HOUSEHOLD_INCOME_OPTIONS} defaultValue={values.household_income}
          error={err?.household_income} />
        <TextField label="Number of people in your household" name="household_size"
          type="number" defaultValue={values.household_size}
          error={err?.household_size} />
        <SelectField label="Did either of your parents attend or complete college?"
          name="parent_college" options={PARENT_COLLEGE_OPTIONS}
          defaultValue={values.parent_college} error={err?.parent_college} />

        {/* ---- Records release (18+) ---- */}
        {data.isAdult && (
          <>
            <SectionHeading>Records release</SectionHeading>
            <p className="mb-6">
              Launchpad needs permission to request your school records. Because
              you&apos;re 18 or older, you can give that permission yourself
              instead of asking a parent or guardian.
            </p>
            <RadioGroup legend="Who will sign your records release form?"
              name="self_release" options={RELEASE_SIGNER_OPTIONS}
              defaultValue={signer} onChange={setSigner} />
            {selfRelease && (
              <Alert tone="info">
                After you submit Step 1, you&apos;ll sign your own records
                release form in Step 2. It&apos;s the same form a parent would
                complete, with you as the signer.
              </Alert>
            )}
          </>
        )}

        {/* ---- Guardians / emergency contact ---- */}
        <SectionHeading>
          {selfRelease
            ? "Emergency contact (optional)"
            : "Parent / guardian information"}
        </SectionHeading>
        {selfRelease && (
          <p className="mb-6 text-xs">
            Someone we can reach if we can&apos;t reach you — a parent,
            guardian, relative, or friend. You can leave this blank.
          </p>
        )}
        <TextField label={`${contactWho} first name`} name="guardian1_first_name"
          optional={selfRelease}
          defaultValue={values.guardian1.first_name} error={err?.guardian1_first_name} />
        <TextField label={`${contactWho} last name`} name="guardian1_last_name"
          optional={selfRelease}
          defaultValue={values.guardian1.last_name} error={err?.guardian1_last_name} />
        <TextField label={`${contactWho} email`} name="guardian1_email" type="email"
          optional={selfRelease}
          defaultValue={values.guardian1.email} error={err?.guardian1_email} />
        <TextField label={`${contactWho} phone number`} name="guardian1_phone" type="tel"
          optional={selfRelease}
          defaultValue={values.guardian1.phone} error={err?.guardian1_phone} />
        <TextField label="Relationship to you" name="guardian1_relationship"
          optional={selfRelease}
          defaultValue={values.guardian1.relationship}
          hint={
            selfRelease
              ? "For example: mother, aunt, friend, partner."
              : "For example: mother, father, grandmother, legal guardian."
          }
          error={err?.guardian1_relationship} />

        {!selfRelease && (
          <RadioGroup legend="Would you like to add a second parent or guardian?"
            name="has_guardian2"
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            defaultValue={hasGuardian2 ? "yes" : "no"}
            onChange={(v) => setHasGuardian2(v === "yes")} />
        )}

        {!selfRelease && hasGuardian2 && (
          <>
            <TextField label="Second guardian's first name" name="guardian2_first_name"
              defaultValue={values.guardian2.first_name} error={err?.guardian2_first_name} />
            <TextField label="Second guardian's last name" name="guardian2_last_name"
              defaultValue={values.guardian2.last_name} error={err?.guardian2_last_name} />
            <TextField label="Second guardian's email" name="guardian2_email" type="email"
              defaultValue={values.guardian2.email} error={err?.guardian2_email} />
            <TextField label="Second guardian's phone number" name="guardian2_phone" type="tel"
              defaultValue={values.guardian2.phone} error={err?.guardian2_phone} />
            <TextField label="Relationship to you" name="guardian2_relationship"
              defaultValue={values.guardian2.relationship}
              hint="For example: mother, father, grandmother, legal guardian."
              error={err?.guardian2_relationship} />
          </>
        )}

        {/* ---- Actions ---- */}
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          {data.complete ? (
            <ActionButton name="intent" value="save" pendingLabel="Saving…">
              Save changes
            </ActionButton>
          ) : (
            <>
              <ActionButton name="intent" value="submit" pendingLabel="Submitting…">
                Submit Step 1
              </ActionButton>
              <ActionButton name="intent" value="save" variant="secondary"
                pendingLabel="Saving…">
                Save progress
              </ActionButton>
            </>
          )}
        </div>
        {!data.complete && (
          <p className="mt-3 text-xs">
            Save progress keeps your answers without submitting. Submitting
            Step 1 unlocks Steps 2–6 and generates your {selfRelease
              ? "records release form"
              : "parent/guardian form link"}. You can still edit Step 1
            afterward.
          </p>
        )}
      </form>
    </>
  );
}
