// Steps 5 and 6 (C2LPHL self-report) share one form; only the copy differs.
// Used by BOTH the client form and the server action, so no `server-only`.

export type C2LState = {
  error?: string;
  success?: string;
};

/** The two steps a student self-reports and staff then verify. */
export type C2LStepNumber = 5 | 6;

export type C2LStepCopy = {
  /** cycle_settings key holding the outbound URL (admin-editable, may be ""). */
  urlKey: string;
  linkLabel: string;
  instructions: string[];
  checkboxLabel: string;
};

export const C2L_COPY: Record<C2LStepNumber, C2LStepCopy> = {
  5: {
    urlKey: "c2l_application_url",
    linkLabel: "Open the C2LPHL application",
    instructions: [
      "Apply to Career Connected Learning PHL (C2LPHL) on their website.",
      "Choose Launchpad as your top choice.",
      "Use the same legal name and date of birth you gave us here — the two systems are matched on those, so a mismatch can hold up your application.",
    ],
    checkboxLabel:
      "I applied to C2LPHL and marked Launchpad as my top choice",
  },
  6: {
    urlKey: "c2l_documents_url",
    linkLabel: "Open C2LPHL to upload documents",
    instructions: [
      "Upload the documents C2LPHL asks for in their system — not here.",
      "Make sure every document is for the same student name and date of birth you gave us.",
      "C2LPHL sets these deadlines, and they often land late in the cycle. We'll let you know when we hear.",
    ],
    checkboxLabel: "I uploaded my required documents to C2LPHL",
  },
};

export function isC2LStep(n: number): n is C2LStepNumber {
  return n === 5 || n === 6;
}
