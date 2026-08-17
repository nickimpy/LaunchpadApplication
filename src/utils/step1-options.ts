// Step 1 option lists, verbatim from the 2026 application PDF. Shared by the
// client form and the server action, so this file stays free of `server-only`.
// Demographic data here is for funder reporting ONLY and must never affect
// application logic (PRD).

import type { FieldErrors } from "@/utils/validation";
import type { Step1Values } from "@/utils/step1";

// Sentinel value for the "Other" entry in the school dropdown (real schools
// are uuids). Lives here, not in the "use server" action file, because that
// file may only export async functions.
export const SCHOOL_OTHER = "other";

export type Step1State = {
  errors?: FieldErrors;
  success?: string;
  /** Set after a successful first submit so the form can show the parent link. */
  justCompleted?: boolean;
  /**
   * The answers just submitted, echoed back on a validation error. React 19
   * resets uncontrolled fields once a form action returns, so without this the
   * whole form empties itself the moment one field fails validation.
   */
  values?: Step1Values;
};

export const GRADUATION_YEARS = [
  "Before 2025",
  "2025",
  "2026",
  "2027",
  "2028",
] as const;

// Juniors (class of 2028) never see Lightspeed — they go straight to
// Foundations (PRD conditional rules 3 & 4). Class of 2027 are rising seniors
// and can choose either program.
export const JUNIOR_GRAD_YEARS: readonly string[] = ["2028"];

export const PROGRAMS = [
  { value: "lightspeed", label: "Launchpad Lightspeed" },
  { value: "foundations", label: "Launchpad Foundations" },
] as const;

// --- Demographics (funder reporting only) -----------------------------------

export const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-Binary",
  "Prefer not to say",
  "Other",
] as const;

export const PRONOUN_OPTIONS = [
  "he/him",
  "she/her",
  "they/them",
  "Prefer not to say",
  "Other",
] as const;

export const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic, Latino, or Spanish Origin",
  "Middle Eastern or North African",
  "Native Hawaiian or Pacific Islander",
  "White",
  "Prefer not to say",
  "Other",
] as const;

export const HOUSEHOLD_INCOME_OPTIONS = [
  "Less than $25,000",
  "$25,000 - $49,999",
  "$50,000 - $74,999",
  "$75,000 - $99,999",
  "$100,000 - $149,999",
  "$150,000 - $199,999",
  "$200,000 and above",
  "Prefer not to say",
] as const;

// Maps the PRD labels to the parent_college_answer enum in the schema.
export const PARENT_COLLEGE_OPTIONS = [
  { value: "both", label: "Both" },
  { value: "one", label: "One" },
  { value: "neither", label: "Neither" },
  { value: "dont_know", label: "Don't know" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const PARENT_COLLEGE_VALUES = PARENT_COLLEGE_OPTIONS.map((o) => o.value);

// --- Lightspeed questions (seniors/graduates who pick Lightspeed) ------------

export const LS_GRAD_STATUS_OPTIONS = [
  "I am currently a High School Senior on track to graduate in Spring 2026",
  "I have already graduated high school or obtained my GED",
] as const;

export const LS_WORK_AUTH_OPTIONS = [
  "I currently have legal work authorization to work in the US",
  "I have applied for legal work authorization to work in the US",
  "I do not have legal work authorization to work in the US",
] as const;

export const LS_SKILLS_OPTIONS = [
  "Python",
  "HTML, CSS",
  "Javascript",
  "Git/GitHub",
  "SQL/databases",
  "API usage and integration",
  "Figma or other wireframing software",
  "ChatGPT or other LLMs",
  "React",
  "None of the above",
] as const;

export const LS_EXPERIENCE_OPTIONS = [
  "Taken a technology course in school",
  "Taken a coding course in school",
  "Taken AP Computer Science",
  "Taken a college coding course",
  "Completed an online coding course",
  "Participated in a technology training program",
  "Participated in a workforce development program",
  "Worked part-time",
  "Worked full-time",
  "None of the above",
] as const;

export const LS_ACADEMIC_YEAR_PLAN_OPTIONS = [
  "I will have no other commitments",
  "I will be working part-time",
  "I will be working full-time",
  "I will be attending college part-time",
  "I will be attending college full-time",
  "I will be both attending college and working",
] as const;

// --- Foundations questions ---------------------------------------------------

export const FND_PATHWAY_OPTIONS = [
  "Entrepreneurial Leadership Only - no interest in tech/coding",
  "Leaning entrepreneurial leadership, but open to tech",
  "I'm open to either pathway!",
  "Leading tech/coding but open to entrepreneurial leadership",
  "Tech/Coding Only - no interest in entrepreneurial leadership",
] as const;

export const FND_TECH_INTEREST_OPTIONS = [
  { value: "1", label: "1 — I have no interest in pursuing a career in tech" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5 — I only want to pursue a career in tech" },
] as const;

export const FND_POST_HS_OPTIONS = [
  "I want to get a good job and work right after high school",
  "I want to take time off after high school but then get a degree",
  "I want to attend CCP/2-year college in Philly right after high school",
  "I want to attend a 4 year college in Philly right after high school",
  "I want to attend college NOT in Philly right after high school",
] as const;

// Selecting this Foundations post-HS plan triggers the (non-blocking) college
// compatibility warning and flags the application for staff review.
export const COLLEGE_WARNING_OPTION =
  "I want to attend college NOT in Philly right after high school";

// Keys used in applications.program_answers (jsonb).
export type ProgramAnswers = {
  ls_grad_status?: string;
  ls_work_auth?: string;
  ls_skills?: string[];
  ls_experiences?: string[];
  ls_courses_detail?: string;
  ls_academic_year_plan?: string;
  fnd_pathway?: string;
  fnd_tech_interest?: string;
  fnd_post_hs_plan?: string;
};
