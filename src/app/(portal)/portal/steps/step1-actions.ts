"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getPortalData, setStepStatus } from "@/utils/step-engine";
import type { Step1Values } from "@/utils/step1";
import { isAdult } from "@/utils/age";
import { dbErrorMessage, type DbError } from "@/utils/db-errors";
import {
  field,
  nameError,
  phoneError,
  emailError,
  gpaError,
  zipError,
  requiredError,
  choiceError,
  householdSizeError,
  multiSelectError,
  type FieldErrors,
} from "@/utils/validation";
import {
  SCHOOL_OTHER,
  type Step1State,
  GRADUATION_YEARS,
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  HOUSEHOLD_INCOME_OPTIONS,
  PARENT_COLLEGE_VALUES,
  FND_PATHWAY_OPTIONS,
  FND_POST_HS_OPTIONS,
  needsCollegeWarning,
  type ProgramAnswers,
} from "@/utils/step1-options";

export async function saveStep1(
  _prev: Step1State,
  formData: FormData,
): Promise<Step1State> {
  const intent = field(formData, "intent") === "submit" ? "submit" : "save";
  const supabase = createClient(await cookies());
  const portal = await getPortalData();
  if (!portal) redirect("/login");
  const applicationId = portal.applicationId;
  const wasComplete = portal.steps[0].status === "complete";

  // --- read fields ---------------------------------------------------------
  const v = {
    first_name: field(formData, "first_name"),
    last_name: field(formData, "last_name"),
    preferred_name: field(formData, "preferred_name"),
    phone: field(formData, "phone"),
    street: field(formData, "street"),
    street_2: field(formData, "street_2"),
    city: field(formData, "city"),
    state: field(formData, "state"),
    zip: field(formData, "zip"),
    school_id: field(formData, "school_id"),
    school_other: field(formData, "school_other"),
    gpa: field(formData, "gpa"),
    graduation_year: field(formData, "graduation_year"),
    referral_source: field(formData, "referral_source"),
    gender: field(formData, "gender"),
    gender_other: field(formData, "gender_other"),
    pronouns: field(formData, "pronouns"),
    pronouns_other: field(formData, "pronouns_other"),
    race_ethnicity: formData.getAll("race_ethnicity").map(String),
    race_ethnicity_other: field(formData, "race_ethnicity_other"),
    household_income: field(formData, "household_income"),
    household_size: field(formData, "household_size"),
    parent_college: field(formData, "parent_college"),
    self_release: field(formData, "self_release") === "yes" ? "yes" : "no",
    has_guardian2: field(formData, "has_guardian2") === "yes",
  };

  const guardian = (n: 1 | 2) => ({
    first_name: field(formData, `guardian${n}_first_name`),
    last_name: field(formData, `guardian${n}_last_name`),
    email: field(formData, `guardian${n}_email`),
    phone: field(formData, `guardian${n}_phone`),
    relationship: field(formData, `guardian${n}_relationship`),
  });
  const g1 = guardian(1);
  const g2 = guardian(2);

  // Launchpad now takes applications for Foundations only, so the program is
  // fixed — there is no selector and no program-specific question set.
  const program = "foundations";
  const usingOtherSchool = v.school_id === SCHOOL_OTHER;

  // Applicants 18+ may authorize the release of their own records. Decided on
  // the SERVER from the stored date of birth — never trusted from the form.
  const { data: studentRow } = await supabase
    .from("students")
    .select("date_of_birth")
    .eq("id", portal.userId)
    .maybeSingle();
  const adult = studentRow?.date_of_birth ? isAdult(studentRow.date_of_birth) : false;
  const selfRelease = adult && v.self_release === "yes";
  // A parent/guardian signs unless the adult applicant signs for themselves; in
  // that case the contact below is just an optional emergency contact.
  const guardianRequired = !selfRelease;
  const hasGuardian2 = !selfRelease && v.has_guardian2;

  const programAnswers: ProgramAnswers = {
    fnd_pathway: field(formData, "fnd_pathway"),
    fnd_post_hs_plan: field(formData, "fnd_post_hs_plan"),
  };

  // Interview track (PRD): partner school -> Track A, otherwise Track B.
  // Graduates go to B too, which falls out naturally — they pick "Other" or a
  // non-partner school. Never overwrite a staff override.
  const trackFromSchool = async (): Promise<"A" | "B" | null> => {
    if (usingOtherSchool) return "B";
    if (!v.school_id) return null; // no school chosen yet; leave track alone
    const { data: school } = await supabase
      .from("schools")
      .select("is_partner")
      .eq("id", v.school_id)
      .maybeSingle();
    if (!school) return null;
    return school.is_partner ? "A" : "B";
  };

  const collegeWarningFlagged = needsCollegeWarning(
    v.graduation_year,
    programAnswers.fnd_post_hs_plan ?? "",
  );

  // --- validation (full only on submit) ------------------------------------
  const errors: FieldErrors = {};
  const set = (k: string, msg: string | null) => {
    if (msg) errors[k] = msg;
  };
  // A GPA that can't be right is rejected on a plain save too, not just on
  // submit — the column holds two decimal places, so an absurd value would
  // otherwise fail the whole save with a generic error.
  const gpaProblem = v.gpa ? gpaError(v.gpa) : null;
  if (gpaProblem) set("gpa", gpaProblem);
  const gpaOk = !gpaProblem;

  // A half-filled optional contact is worse than none: staff couldn't use it.
  const guardianFilled = (g: typeof g1) =>
    Boolean(g.first_name || g.last_name || g.email || g.phone || g.relationship);

  if (intent === "submit") {
    set("first_name", nameError(v.first_name, "first name"));
    set("last_name", nameError(v.last_name, "last name"));
    set("phone", phoneError(v.phone));
    set("street", requiredError(v.street, "street address"));
    set("city", requiredError(v.city, "city"));
    set("state", requiredError(v.state, "state"));
    set("zip", zipError(v.zip));

    if (usingOtherSchool) {
      set("school_other", requiredError(v.school_other, "high school name"));
    } else if (!v.school_id) {
      set("school_id", "Choose your school.");
    }
    set("gpa", gpaError(v.gpa));
    set("graduation_year", choiceError(
      v.graduation_year,
      GRADUATION_YEARS,
      "your graduation year",
    ));

    // Demographics
    set("gender", choiceError(v.gender, GENDER_OPTIONS, "a gender identity"));
    if (v.gender === "Other")
      set("gender_other", requiredError(v.gender_other, "gender identity"));
    set("pronouns", choiceError(v.pronouns, PRONOUN_OPTIONS, "your pronouns"));
    if (v.pronouns === "Other")
      set("pronouns_other", requiredError(v.pronouns_other, "pronouns"));
    set("race_ethnicity", multiSelectError(v.race_ethnicity, "race/ethnicity"));
    if (v.race_ethnicity.includes("Other"))
      set(
        "race_ethnicity_other",
        requiredError(v.race_ethnicity_other, "race/ethnicity"),
      );
    set(
      "household_income",
      choiceError(v.household_income, HOUSEHOLD_INCOME_OPTIONS, "an income range"),
    );
    set("household_size", householdSizeError(v.household_size));
    set(
      "parent_college",
      choiceError(v.parent_college, PARENT_COLLEGE_VALUES, "an answer"),
    );

    // Pathway interest + plans after high school
    set(
      "fnd_pathway",
      choiceError(programAnswers.fnd_pathway ?? "", FND_PATHWAY_OPTIONS, "a pathway"),
    );
    set(
      "fnd_post_hs_plan",
      choiceError(programAnswers.fnd_post_hs_plan ?? "", FND_POST_HS_OPTIONS, "an option"),
    );

    // Guardian 1 is required unless an adult is signing for themselves, in
    // which case it's an optional emergency contact — but if they start filling
    // it in, the whole contact has to be usable.
    const checkGuardian = (n: 1 | 2, g: typeof g1, who: string) => {
      set(`guardian${n}_first_name`, nameError(g.first_name, `${who} first name`));
      set(`guardian${n}_last_name`, nameError(g.last_name, `${who} last name`));
      set(`guardian${n}_email`, emailError(g.email));
      set(`guardian${n}_phone`, phoneError(g.phone));
      // Voiced from the STUDENT's side — they're describing their contact
      // here. (The parent form asks the same thing the other way round.)
      set(
        `guardian${n}_relationship`,
        g.relationship
          ? null
          : "Tell us how this person is related to you.",
      );
    };
    if (guardianRequired || guardianFilled(g1)) {
      checkGuardian(1, g1, guardianRequired ? "guardian's" : "emergency contact's");
    }
    if (hasGuardian2) checkGuardian(2, g2, "second guardian's");
  }

  // A failed submit is persisted like a save rather than thrown away — losing
  // a long form to one bad field is the worst thing this page could do.
  const hasErrors = Object.keys(errors).length > 0;

  /** Everything just typed, echoed back so the form can re-render with it. */
  const echo = (): Step1Values => ({
    ...v,
    // Read-only in the form and ignored when persisting (Profile owns it), but
    // still echoed so the field doesn't render blank after an error.
    email: field(formData, "email"),
    program_answers: programAnswers,
    guardian1: g1,
    guardian2: g2,
  });

  // --- persist -------------------------------------------------------------
  // Each write says which part failed and why (expired session, missing
  // migration, bad value…) instead of one blanket "couldn't save".
  const failed = (error: DbError, what: string) =>
    dbErrorMessage(error, {
      audience: "student",
      action: what,
      contactEmail: portal.contactEmail,
    });
  const orNull = (s: string) => (s ? s : null);

  const { error: studentErr } = await supabase
    .from("students")
    .update({
      first_name: v.first_name,
      last_name: v.last_name,
      preferred_name: orNull(v.preferred_name),
      phone: v.phone,
    })
    .eq("id", portal.userId);
  if (studentErr) return { errors: { form: failed(studentErr, "save your name and phone number") }, values: echo() };

  // Respect a staff override: the admin table sets track_overridden when a
  // human picks a track, and auto-assignment must not undo that decision.
  const { data: current } = await supabase
    .from("applications")
    .select("track_overridden")
    .eq("id", applicationId)
    .maybeSingle();
  const autoTrack = current?.track_overridden ? null : await trackFromSchool();

  const { error: appErr } = await supabase
    .from("applications")
    .update({
      street: orNull(v.street),
      street_2: orNull(v.street_2),
      city: orNull(v.city),
      state: orNull(v.state),
      zip: orNull(v.zip),
      school_id: usingOtherSchool ? null : orNull(v.school_id),
      school_other: usingOtherSchool ? orNull(v.school_other) : null,
      gpa: v.gpa && gpaOk ? Number(v.gpa) : null,
      graduation_year: orNull(v.graduation_year),
      referral_source: orNull(v.referral_source),
      program,
      program_answers: programAnswers,
      self_release: selfRelease,
      college_warning_flagged: collegeWarningFlagged,
      ...(autoTrack ? { track: autoTrack } : {}),
      // Stamp the parent-link generation time on first completion — but not
      // when validation failed, since the step isn't actually complete.
      ...(intent === "submit" && !wasComplete && !hasErrors
        ? { parent_link_generated_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", applicationId);
  if (appErr) return { errors: { form: failed(appErr, "save your application answers") }, values: echo() };

  const { error: demoErr } = await supabase.from("demographics").upsert(
    {
      application_id: applicationId,
      gender: orNull(v.gender),
      gender_other: v.gender === "Other" ? orNull(v.gender_other) : null,
      pronouns: orNull(v.pronouns),
      pronouns_other: v.pronouns === "Other" ? orNull(v.pronouns_other) : null,
      race_ethnicity: v.race_ethnicity,
      race_ethnicity_other: v.race_ethnicity.includes("Other")
        ? orNull(v.race_ethnicity_other)
        : null,
      household_income: orNull(v.household_income),
      household_size: v.household_size ? Number(v.household_size) : null,
      parent_college: orNull(v.parent_college),
    },
    { onConflict: "application_id" },
  );
  if (demoErr) return { errors: { form: failed(demoErr, "save your demographic answers") }, values: echo() };

  // Guardian rows. Columns are NOT NULL but accept the empty strings a partial
  // save leaves behind. An adult signing for themselves may leave the optional
  // emergency contact blank entirely — then there's simply no row, rather than
  // an empty one staff would have to puzzle over.
  if (!guardianRequired && !guardianFilled(g1)) {
    await supabase.from("guardians").delete().eq("application_id", applicationId);
  } else {
    const { error: g1Err } = await supabase
      .from("guardians")
      .upsert({ application_id: applicationId, position: 1, ...g1 }, {
        onConflict: "application_id,position",
      });
    if (g1Err) return { errors: { form: failed(g1Err, "save your parent/guardian contact") }, values: echo() };

    if (hasGuardian2) {
      const { error: g2Err } = await supabase
        .from("guardians")
        .upsert({ application_id: applicationId, position: 2, ...g2 }, {
          onConflict: "application_id,position",
        });
      if (g2Err) return { errors: { form: failed(g2Err, "save your second guardian's contact") }, values: echo() };
    } else {
      await supabase
        .from("guardians")
        .delete()
        .eq("application_id", applicationId)
        .eq("position", 2);
    }
  }

  // --- step status ---------------------------------------------------------
  // The answers are safely stored by this point, so a failed submit can now
  // report its errors without having cost the student anything. It moves the
  // step to in_progress, never complete.
  if (hasErrors) {
    if (!wasComplete) await setStepStatus(1, "in_progress");
    revalidatePath("/portal", "layout");
    return { errors, values: echo() };
  }

  if (intent === "submit") {
    const { error } = await setStepStatus(1, "complete");
    if (error) return { errors: { form: error }, values: echo() };
  } else if (!wasComplete) {
    // Saving partial progress moves a not-started step to in_progress, but
    // never downgrades a step that was already submitted/complete.
    const { error } = await setStepStatus(1, "in_progress");
    if (error) return { errors: { form: error }, values: echo() };
  }

  // Refresh the sidebar (steps 2–6 unlock on first complete) and this page.
  revalidatePath("/portal", "layout");

  return {
    success:
      intent === "submit"
        ? wasComplete
          ? "Your Step 1 answers have been updated."
          : "Step 1 is complete! Steps 2–6 are now unlocked."
        : "Your progress has been saved.",
    justCompleted: intent === "submit" && !wasComplete,
  };
}

