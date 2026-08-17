"use client";

import { useActionState, useState } from "react";
import { saveStep1 } from "@/app/(portal)/portal/steps/step1-actions";
import type { Step1Data } from "@/utils/step1";
import { ParentLinkBox } from "@/components/portal/parent-link-box";
import {
  Alert,
  ActionButton,
  CheckboxGroup,
  RadioGroup,
  SelectField,
  TextField,
  Textarea,
} from "@/components/forms";
import {
  SCHOOL_OTHER,
  type Step1State,
  GRADUATION_YEARS,
  JUNIOR_GRAD_YEARS,
  PROGRAMS,
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  RACE_OPTIONS,
  HOUSEHOLD_INCOME_OPTIONS,
  PARENT_COLLEGE_OPTIONS,
  LS_GRAD_STATUS_OPTIONS,
  LS_WORK_AUTH_OPTIONS,
  LS_SKILLS_OPTIONS,
  LS_EXPERIENCE_OPTIONS,
  LS_ACADEMIC_YEAR_PLAN_OPTIONS,
  FND_PATHWAY_OPTIONS,
  FND_TECH_INTEREST_OPTIONS,
  FND_POST_HS_OPTIONS,
  COLLEGE_WARNING_OPTION,
} from "@/utils/step1-options";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-9 border-b border-grey-tint2 pb-1 text-lg font-bold first:mt-0">
      {children}
    </h2>
  );
}

export function Step1Form({ data }: { data: Step1Data }) {
  const { values } = data;
  const [state, action] = useActionState<Step1State, FormData>(saveStep1, {});
  const err = state.errors;

  const [gradYear, setGradYear] = useState(values.graduation_year);
  const [program, setProgram] = useState(values.program);
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

  const isJunior = JUNIOR_GRAD_YEARS.includes(gradYear);
  // Juniors skip program selection and go straight to Foundations (rules 3 & 4).
  const effectiveProgram = isJunior ? "foundations" : program;
  const showLightspeed = effectiveProgram === "lightspeed";
  const showFoundations = effectiveProgram === "foundations";
  const showCollegeWarning =
    showFoundations && !isJunior && postHsPlan === COLLEGE_WARNING_OPTION;

  const schoolOptions = [
    ...data.schools.map((s) => ({ value: s.id, label: s.name })),
    { value: SCHOOL_OTHER, label: "Other" },
  ];

  const pa = values.program_answers;

  return (
    <>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {err?.form && <Alert tone="error">{err.form}</Alert>}
      {err && !err.form && (
        <Alert tone="error">
          Please fix the highlighted fields below, then submit again.
        </Alert>
      )}
      {data.parentLinkUrl && <ParentLinkBox url={data.parentLinkUrl} />}

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
          defaultValue={values.gpa} error={err?.gpa}
          hint="Your cumulative weighted GPA, for example 3.5." />
        <SelectField label="Graduation year" name="graduation_year"
          options={GRADUATION_YEARS} defaultValue={values.graduation_year}
          onChange={setGradYear} error={err?.graduation_year}
          hint="Students graduating in 2029 or later are not currently eligible to apply." />
        <TextField label="How did you hear about Launchpad?" name="referral_source"
          optional defaultValue={values.referral_source} error={err?.referral_source} />

        {/* ---- Program ---- */}
        <SectionHeading>Program</SectionHeading>
        {isJunior ? (
          <Alert tone="info">
            Because you&apos;re graduating in {gradYear}, you&apos;ll apply to{" "}
            <span className="font-bold">Launchpad Foundations</span>.
          </Alert>
        ) : (
          <RadioGroup legend="Which program are you applying to?" name="program"
            options={PROGRAMS} defaultValue={values.program}
            onChange={setProgram} error={err?.program} />
        )}

        {showLightspeed && (
          <>
            {data.programInfo.lightspeed && (
              <Alert tone="info">{data.programInfo.lightspeed}</Alert>
            )}
            <RadioGroup legend="Which of the following best describes you?"
              name="ls_grad_status" options={LS_GRAD_STATUS_OPTIONS}
              defaultValue={pa.ls_grad_status} error={err?.ls_grad_status} />
            <RadioGroup legend="Which of the following best describes you?"
              name="ls_work_auth" options={LS_WORK_AUTH_OPTIONS}
              defaultValue={pa.ls_work_auth} error={err?.ls_work_auth} />
            <CheckboxGroup
              legend="Which of the following skills do you have experience with? (check all that apply)"
              name="ls_skills" options={LS_SKILLS_OPTIONS}
              defaultValues={pa.ls_skills ?? []} error={err?.ls_skills} />
            <CheckboxGroup
              legend="Which of the following have you done before? (check all that apply)"
              name="ls_experiences" options={LS_EXPERIENCE_OPTIONS}
              defaultValues={pa.ls_experiences ?? []} error={err?.ls_experiences} />
            <Textarea
              label="Please share the specific courses/experiences you've completed including dates and outcomes (certifications earned, AP exam scores, credits received, etc.)"
              name="ls_courses_detail" optional
              defaultValue={pa.ls_courses_detail} error={err?.ls_courses_detail} />
            <RadioGroup
              legend="Which of the following best describes your plans for the 2025-2026 academic year?"
              name="ls_academic_year_plan" options={LS_ACADEMIC_YEAR_PLAN_OPTIONS}
              defaultValue={pa.ls_academic_year_plan}
              error={err?.ls_academic_year_plan} />
          </>
        )}

        {showFoundations && (
          <>
            {data.programInfo.foundations && (
              <Alert tone="info">{data.programInfo.foundations}</Alert>
            )}
            <RadioGroup legend="Currently, what pathway are you most interested in?"
              name="fnd_pathway" options={FND_PATHWAY_OPTIONS}
              defaultValue={pa.fnd_pathway} error={err?.fnd_pathway} />
            <RadioGroup legend="How interested are you in pursuing a career in tech?"
              name="fnd_tech_interest" options={FND_TECH_INTEREST_OPTIONS}
              defaultValue={pa.fnd_tech_interest} error={err?.fnd_tech_interest} />
            <RadioGroup legend="What are your current plans for after high school?"
              name="fnd_post_hs_plan" options={FND_POST_HS_OPTIONS}
              defaultValue={pa.fnd_post_hs_plan} onChange={setPostHsPlan}
              error={err?.fnd_post_hs_plan} />
            {showCollegeWarning && (
              <Alert tone="info">
                <span className="font-bold">A quick heads-up:</span> Launchpad
                is a full-time program based in Philadelphia, so it may not fit
                with attending college outside Philly right after high school.
                You can still continue — your application will be flagged so our
                team can talk it through with you. Questions? Email{" "}
                <a className="font-bold underline" href={`mailto:${data.contactEmail}`}>
                  {data.contactEmail}
                </a>
                .
              </Alert>
            )}
          </>
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
        <SelectField label="Did either parent attend or complete college?"
          name="parent_college" options={PARENT_COLLEGE_OPTIONS}
          defaultValue={values.parent_college} error={err?.parent_college} />

        {/* ---- Guardians ---- */}
        <SectionHeading>Parent / guardian information</SectionHeading>
        <TextField label="Guardian's first name" name="guardian1_first_name"
          defaultValue={values.guardian1.first_name} error={err?.guardian1_first_name} />
        <TextField label="Guardian's last name" name="guardian1_last_name"
          defaultValue={values.guardian1.last_name} error={err?.guardian1_last_name} />
        <TextField label="Guardian's email" name="guardian1_email" type="email"
          defaultValue={values.guardian1.email} error={err?.guardian1_email} />
        <TextField label="Guardian's phone number" name="guardian1_phone" type="tel"
          defaultValue={values.guardian1.phone} error={err?.guardian1_phone} />
        <TextField label="Relationship to you" name="guardian1_relationship"
          defaultValue={values.guardian1.relationship}
          error={err?.guardian1_relationship} />

        <RadioGroup legend="Would you like to add a second parent or guardian?"
          name="has_guardian2"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          defaultValue={hasGuardian2 ? "yes" : "no"}
          onChange={(v) => setHasGuardian2(v === "yes")} />

        {hasGuardian2 && (
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
            Step 1 unlocks Steps 2–6 and generates your parent/guardian form
            link. You can still edit Step 1 afterward.
          </p>
        )}
      </form>
    </>
  );
}
