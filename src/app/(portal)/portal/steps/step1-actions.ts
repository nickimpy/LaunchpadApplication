"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getPortalData, setStepStatus } from "@/utils/step-engine";
import type { Step1Values } from "@/utils/step1";
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
  JUNIOR_GRAD_YEARS,
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  HOUSEHOLD_INCOME_OPTIONS,
  PARENT_COLLEGE_VALUES,
  LS_GRAD_STATUS_OPTIONS,
  LS_WORK_AUTH_OPTIONS,
  LS_ACADEMIC_YEAR_PLAN_OPTIONS,
  FND_PATHWAY_OPTIONS,
  FND_TECH_INTEREST_OPTIONS,
  FND_POST_HS_OPTIONS,
  COLLEGE_WARNING_OPTION,
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

  const isJunior = JUNIOR_GRAD_YEARS.includes(v.graduation_year);
  const program = isJunior ? "foundations" : field(formData, "program");
  const usingOtherSchool = v.school_id === SCHOOL_OTHER;

  // Program-specific answers (only the active program's block is stored).
  const programAnswers: ProgramAnswers = {};
  if (program === "lightspeed") {
    programAnswers.ls_grad_status = field(formData, "ls_grad_status");
    programAnswers.ls_work_auth = field(formData, "ls_work_auth");
    programAnswers.ls_skills = formData.getAll("ls_skills").map(String);
    programAnswers.ls_experiences = formData
      .getAll("ls_experiences")
      .map(String);
    programAnswers.ls_courses_detail = field(formData, "ls_courses_detail");
    programAnswers.ls_academic_year_plan = field(
      formData,
      "ls_academic_year_plan",
    );
  } else if (program === "foundations") {
    programAnswers.fnd_pathway = field(formData, "fnd_pathway");
    programAnswers.fnd_tech_interest = field(formData, "fnd_tech_interest");
    programAnswers.fnd_post_hs_plan = field(formData, "fnd_post_hs_plan");
  }

  const collegeWarningFlagged =
    program === "foundations" &&
    !isJunior &&
    programAnswers.fnd_post_hs_plan === COLLEGE_WARNING_OPTION;

  // --- validation (full only on submit) ------------------------------------
  const errors: FieldErrors = {};
  if (intent === "submit") {
    const set = (k: string, msg: string | null) => {
      if (msg) errors[k] = msg;
    };
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

    // Program
    if (program !== "lightspeed" && program !== "foundations") {
      set("program", "Choose a program.");
    } else if (program === "lightspeed") {
      set(
        "ls_grad_status",
        choiceError(programAnswers.ls_grad_status ?? "", LS_GRAD_STATUS_OPTIONS, "an option"),
      );
      set(
        "ls_work_auth",
        choiceError(programAnswers.ls_work_auth ?? "", LS_WORK_AUTH_OPTIONS, "an option"),
      );
      set("ls_skills", multiSelectError(programAnswers.ls_skills ?? [], "your skills"));
      set(
        "ls_experiences",
        multiSelectError(programAnswers.ls_experiences ?? [], "your experience"),
      );
      set(
        "ls_academic_year_plan",
        choiceError(
          programAnswers.ls_academic_year_plan ?? "",
          LS_ACADEMIC_YEAR_PLAN_OPTIONS,
          "an option",
        ),
      );
    } else {
      set(
        "fnd_pathway",
        choiceError(programAnswers.fnd_pathway ?? "", FND_PATHWAY_OPTIONS, "a pathway"),
      );
      set(
        "fnd_tech_interest",
        choiceError(
          programAnswers.fnd_tech_interest ?? "",
          FND_TECH_INTEREST_OPTIONS.map((o) => o.value),
          "an option",
        ),
      );
      set(
        "fnd_post_hs_plan",
        choiceError(programAnswers.fnd_post_hs_plan ?? "", FND_POST_HS_OPTIONS, "an option"),
      );
    }

    // Guardian 1 (required); Guardian 2 only if "Yes".
    const checkGuardian = (n: 1 | 2, g: typeof g1) => {
      set(`guardian${n}_first_name`, nameError(g.first_name, "guardian's first name"));
      set(`guardian${n}_last_name`, nameError(g.last_name, "guardian's last name"));
      set(`guardian${n}_email`, emailError(g.email));
      set(`guardian${n}_phone`, phoneError(g.phone));
      set(
        `guardian${n}_relationship`,
        requiredError(g.relationship, "relationship to the student"),
      );
    };
    checkGuardian(1, g1);
    if (v.has_guardian2) checkGuardian(2, g2);
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
    program: program === "lightspeed" || program === "foundations" ? program : "",
    program_answers: programAnswers,
    guardian1: g1,
    guardian2: g2,
  });

  // --- persist -------------------------------------------------------------
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
  if (studentErr) return { errors: { form: SAVE_FAILED }, values: echo() };

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
      gpa: v.gpa ? Number(v.gpa) : null,
      graduation_year: orNull(v.graduation_year),
      referral_source: orNull(v.referral_source),
      program: program === "lightspeed" || program === "foundations" ? program : null,
      program_answers: programAnswers,
      college_warning_flagged: collegeWarningFlagged,
      // Stamp the parent-link generation time on first completion — but not
      // when validation failed, since the step isn't actually complete.
      ...(intent === "submit" && !wasComplete && !hasErrors
        ? { parent_link_generated_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", applicationId);
  if (appErr) return { errors: { form: SAVE_FAILED }, values: echo() };

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
  if (demoErr) return { errors: { form: SAVE_FAILED }, values: echo() };

  // Guardian 1 always upserted; columns are NOT NULL but accept the empty
  // strings that a partial save leaves behind.
  const { error: g1Err } = await supabase
    .from("guardians")
    .upsert({ application_id: applicationId, position: 1, ...g1 }, {
      onConflict: "application_id,position",
    });
  if (g1Err) return { errors: { form: SAVE_FAILED }, values: echo() };

  if (v.has_guardian2) {
    const { error: g2Err } = await supabase
      .from("guardians")
      .upsert({ application_id: applicationId, position: 2, ...g2 }, {
        onConflict: "application_id,position",
      });
    if (g2Err) return { errors: { form: SAVE_FAILED }, values: echo() };
  } else {
    await supabase
      .from("guardians")
      .delete()
      .eq("application_id", applicationId)
      .eq("position", 2);
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

const SAVE_FAILED = "We couldn't save your answers. Please try again.";
