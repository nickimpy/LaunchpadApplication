// Step 3 bits shared by BOTH the client form and the server action, so this
// file stays free of `server-only` (same split as step1-options.ts).

import type { FieldErrors } from "@/utils/validation";

/**
 * Form field name carrying one prompt's answer. Prompts are admin-editable
 * rows, so field names are derived from prompt ids rather than hardcoded —
 * the scaffolded question set can replace the beta prompt as a data change.
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
