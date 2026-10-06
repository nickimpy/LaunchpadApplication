// Step 3 bits shared by BOTH the client form and the server action, so this
// file stays free of `server-only` (same split as step1-options.ts).

import type { FieldErrors } from "@/utils/validation";

/**
 * The Step 3 questions. Hard-coded on purpose: the set is fixed for the
 * application, and the word window below is enforced against it. Each one is
 * mirrored into an `essay_prompts` row (see utils/essay-prompts.ts) because
 * answers are stored against a prompt id — edit the wording HERE, not in the
 * database, and the row follows.
 */
export const STEP3_QUESTIONS = [
  "What are you planning to do after completing Launchpad? How will Launchpad help you achieve that goal?",
  "What’s your prior experience with AI, coding, and/or entrepreneurship?",
  "What is a problem in your community you’d like to solve with the help of technology?",
] as const;

export const STEP3_MIN_WORDS = 50;
export const STEP3_MAX_WORDS = 250;

export function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Form field name carrying one prompt's answer. Field names are derived from
 * prompt ids (the rows the questions above are synced into), not hardcoded.
 */
export function responseField(promptId: string): string {
  return `response_${promptId}`;
}

export type Step3State = {
  errors?: FieldErrors;
  success?: string;
  /** Set after a successful first submit, for the confirmation copy. */
  justCompleted?: boolean;
  /**
   * promptId → answer. React 19 resets uncontrolled fields once a form action
   * returns, so the action always echoes the answers back or the student's
   * writing disappears off the screen.
   */
  values?: Record<string, string>;
};
