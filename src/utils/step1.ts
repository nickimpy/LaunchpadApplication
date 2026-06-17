import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getOrigin } from "@/utils/origin";
import { getPortalData } from "@/utils/step-engine";
import type { StepStatus } from "@/utils/steps";
import type { ProgramAnswers } from "@/utils/step1-options";

export type GuardianValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  relationship: string;
};

const EMPTY_GUARDIAN: GuardianValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  relationship: "",
};

export type Step1Values = {
  // Personal (name/phone live on students; email is managed in Profile)
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  street: string;
  street_2: string;
  city: string;
  state: string;
  zip: string;
  // Academic
  school_id: string;
  school_other: string;
  gpa: string;
  graduation_year: string;
  referral_source: string;
  // Program
  program: string;
  program_answers: ProgramAnswers;
  // Demographics (funder reporting only)
  gender: string;
  gender_other: string;
  pronouns: string;
  pronouns_other: string;
  race_ethnicity: string[];
  race_ethnicity_other: string;
  household_income: string;
  household_size: string;
  parent_college: string;
  // Guardians
  guardian1: GuardianValues;
  has_guardian2: boolean;
  guardian2: GuardianValues;
};

export type Step1Data = {
  applicationId: string;
  status: StepStatus;
  complete: boolean;
  contactEmail: string;
  schools: { id: string; name: string }[];
  programInfo: { lightspeed: string; foundations: string };
  parentLinkUrl: string | null;
  values: Step1Values;
};

/**
 * Loads everything the Step 1 form needs to render: the student's saved
 * answers (application + demographics + guardians + personal fields), the
 * schools dropdown, the admin-editable program info copy, and the parent
 * form link once it has been generated. Returns null when logged out.
 */
export async function getStep1Data(): Promise<Step1Data | null> {
  const portal = await getPortalData();
  if (!portal) return null;

  const supabase = createClient(await cookies());
  const applicationId = portal.applicationId;
  const status = portal.steps[0].status;

  const [
    { data: student },
    { data: application },
    { data: demographics },
    { data: guardians },
    { data: schools },
    { data: settingRows },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("first_name, last_name, preferred_name, email, phone")
      .eq("id", portal.userId)
      .maybeSingle(),
    supabase
      .from("applications")
      .select(
        "street, street_2, city, state, zip, school_id, school_other, gpa, graduation_year, referral_source, program, program_answers, parent_link_token, parent_link_generated_at",
      )
      .eq("id", applicationId)
      .maybeSingle(),
    supabase
      .from("demographics")
      .select(
        "gender, gender_other, pronouns, pronouns_other, race_ethnicity, race_ethnicity_other, household_income, household_size, parent_college",
      )
      .eq("application_id", applicationId)
      .maybeSingle(),
    supabase
      .from("guardians")
      .select("position, first_name, last_name, email, phone, relationship")
      .eq("application_id", applicationId)
      .order("position"),
    supabase.from("schools").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("cycle_settings")
      .select("key, value")
      .in("key", ["program_info_lightspeed", "program_info_foundations"]),
  ]);

  const settings = new Map(settingRows?.map((r) => [r.key, r.value]) ?? []);
  const asText = (v: unknown) => (typeof v === "string" ? v : "");

  const g1 = guardians?.find((g) => g.position === 1);
  const g2 = guardians?.find((g) => g.position === 2);

  const origin = await getOrigin();
  const token = application?.parent_link_token as string | undefined;
  const parentLinkUrl =
    token && (application?.parent_link_generated_at || status === "complete")
      ? `${origin}/parent/${token}`
      : null;

  const toGuardian = (g: typeof g1): GuardianValues =>
    g
      ? {
          first_name: g.first_name ?? "",
          last_name: g.last_name ?? "",
          email: g.email ?? "",
          phone: g.phone ?? "",
          relationship: g.relationship ?? "",
        }
      : { ...EMPTY_GUARDIAN };

  return {
    applicationId,
    status,
    complete: status === "complete",
    contactEmail: portal.contactEmail,
    schools: schools ?? [],
    programInfo: {
      lightspeed: asText(settings.get("program_info_lightspeed")),
      foundations: asText(settings.get("program_info_foundations")),
    },
    parentLinkUrl,
    values: {
      first_name: student?.first_name ?? "",
      last_name: student?.last_name ?? "",
      preferred_name: student?.preferred_name ?? "",
      email: student?.email ?? "",
      phone: student?.phone ?? "",
      street: application?.street ?? "",
      street_2: application?.street_2 ?? "",
      city: application?.city ?? "",
      state: application?.state ?? "",
      zip: application?.zip ?? "",
      school_id: application?.school_id ?? "",
      school_other: application?.school_other ?? "",
      gpa: application?.gpa != null ? String(application.gpa) : "",
      graduation_year: application?.graduation_year ?? "",
      referral_source: application?.referral_source ?? "",
      program: application?.program ?? "",
      program_answers: (application?.program_answers as ProgramAnswers) ?? {},
      gender: demographics?.gender ?? "",
      gender_other: demographics?.gender_other ?? "",
      pronouns: demographics?.pronouns ?? "",
      pronouns_other: demographics?.pronouns_other ?? "",
      race_ethnicity: demographics?.race_ethnicity ?? [],
      race_ethnicity_other: demographics?.race_ethnicity_other ?? "",
      household_income: demographics?.household_income ?? "",
      household_size:
        demographics?.household_size != null
          ? String(demographics.household_size)
          : "",
      parent_college: demographics?.parent_college ?? "",
      guardian1: toGuardian(g1),
      has_guardian2: Boolean(g2),
      guardian2: toGuardian(g2),
    },
  };
}
