// Interview rubric copy, from "Launchpad Interview Process & Applicant Rubric
// 2026" via the PRD. Shared by the client form and the server action, so this
// file must stay free of "use server" — those modules may only export async
// functions (see document-options.ts for what happens otherwise).

/** Matches the rubric_criterion enum, in the order interviewers score them. */
export const RUBRIC_CRITERIA = [
  {
    value: "passion",
    label: "Passion",
    hint: "For technology or entrepreneurship as a career pathway.",
  },
  {
    value: "purpose",
    label: "Purpose",
    hint: "Post-secondary plan aligned with the program model.",
  },
  {
    value: "persistence",
    label: "Persistence",
    hint: "Has set a goal and persisted through challenges.",
  },
  {
    value: "collaboration",
    label: "Collaboration",
    hint: "Group work, and valuing other people's perspectives.",
  },
  {
    value: "prior_knowledge",
    label: "Prior knowledge",
    hint: "Exposure to AI, tech, or entrepreneurship.",
  },
  {
    value: "external_support",
    label: "External support",
    hint: "Support network. Top scores require a submitted parent/guardian form — its status is shown above.",
  },
  {
    value: "communication",
    label: "Communication",
    hint: "Written and verbal, including the short answers — linked above.",
  },
] as const;

export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number]["value"];

/** 0–3 alignment scale used for every criterion. */
export const SCORE_OPTIONS = [
  { value: "0", label: "0 — Unaligned" },
  { value: "1", label: "1 — Minimally aligned" },
  { value: "2", label: "2 — Mostly aligned" },
  { value: "3", label: "3 — Completely aligned" },
] as const;

export const SCORE_VALUES: readonly string[] = SCORE_OPTIONS.map((o) => o.value);

/** Matches the pathway_preference enum (PRD's 5-point scale). */
export const PATHWAY_OPTIONS = [
  { value: "el_only", label: "Entrepreneurial leadership only" },
  { value: "leaning_el", label: "Leaning entrepreneurial leadership" },
  { value: "open_to_either", label: "Open to either" },
  { value: "leaning_tech", label: "Leaning tech / coding" },
  { value: "tech_only", label: "Tech / coding only" },
] as const;

export const PATHWAY_VALUES: readonly string[] = PATHWAY_OPTIONS.map(
  (o) => o.value,
);

export const PATHWAY_LABELS: Record<string, string> = Object.fromEntries(
  PATHWAY_OPTIONS.map((o) => [o.value, o.label]),
);

export const CRITERION_LABELS: Record<string, string> = Object.fromEntries(
  RUBRIC_CRITERIA.map((c) => [c.value, c.label]),
);

/** Field name carrying the chosen interviewers (a multi-select). */
export const INTERVIEWERS_FIELD = "interviewer_ids";

export type InterviewState = {
  error?: string;
  success?: string;
  /** Echoed back on error — React 19 resets uncontrolled fields after actions. */
  values?: Record<string, string>;
};

/** Field name carrying one criterion's score / note. */
export const scoreField = (criterion: string) => `score_${criterion}`;
export const noteField = (criterion: string) => `note_${criterion}`;
