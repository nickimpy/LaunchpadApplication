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

// Launchpad now takes applications for Foundations only. Applicants who will
// graduate in 2027 or earlier are in college (or working) by the time the
// program starts, so those are the classes the college-schedule warning
// applies to; class of 2028 are rising seniors with time before college.
export const COLLEGE_CONFLICT_GRAD_YEARS: readonly string[] = [
  "Before 2025",
  "2025",
  "2026",
  "2027",
];

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

// --- Foundations questions ---------------------------------------------------

/** The two pathways, shown above the pathway-interest question. */
export const PATHWAYS = [
  {
    name: "Software Engineering",
    points: [
      "Develop and practice AI and Python coding skills.",
      "Explore AI-powered web, app, and product design.",
      "Earn the PCEP-30 Python Certification.",
    ],
  },
  {
    name: "Entrepreneurial Leadership",
    points: [
      "Build and launch your own business.",
      "Pitch solutions to business industry leaders.",
      "Get certified by the Project Management Institute.",
    ],
  },
] as const;

export const FND_PATHWAY_OPTIONS = [
  "Entrepreneurial Leadership Only - no interest in tech/coding",
  "Leaning entrepreneurial leadership, but open to tech",
  "I'm open to either pathway!",
  "Leading tech/coding but open to entrepreneurial leadership",
  "Tech/Coding Only - no interest in entrepreneurial leadership",
] as const;

export const FND_POST_HS_OPTIONS = [
  "I want to get a good job and work right after high school",
  "I want to take time off after high school but then get a degree",
  "I want to attend CCP/2-year college in Philly right after high school",
  "I want to attend a 4 year college in Philly right after high school",
  "I want to attend college NOT in Philly right after high school",
  "I want to attend trade school right after high school",
] as const;

// Choosing one of these (as a class of 2027 or earlier) triggers the
// non-blocking college-schedule warning and flags the application for staff.
export const COLLEGE_WARNING_OPTIONS: readonly string[] = [
  "I want to attend a 4 year college in Philly right after high school",
  "I want to attend college NOT in Philly right after high school",
];

/** Whether the college-schedule warning applies to this grad year + plan. */
export function needsCollegeWarning(gradYear: string, postHsPlan: string): boolean {
  return (
    COLLEGE_CONFLICT_GRAD_YEARS.includes(gradYear) &&
    COLLEGE_WARNING_OPTIONS.includes(postHsPlan)
  );
}

// Keys used in applications.program_answers (jsonb). Older rows may still
// carry retired keys (Lightspeed answers, the 1-5 tech-interest scale); they
// are left alone in the database and simply no longer collected or shown here.
export type ProgramAnswers = {
  fnd_pathway?: string;
  fnd_post_hs_plan?: string;
};

// --- Records release (18+) ---------------------------------------------------

// Applicants who are 18 or older can authorize the release of their own records
// instead of asking a parent or guardian to.
export const RELEASE_SIGNER_OPTIONS = [
  { value: "no", label: "My parent or guardian will sign it" },
  { value: "yes", label: "I will sign it myself" },
] as const;
