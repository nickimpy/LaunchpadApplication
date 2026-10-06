// Steps 5 and 6 (C2LPHL self-report) share one form; only the copy differs.
// Used by BOTH the client form and the server action, so no `server-only`.

export type C2LState = {
  error?: string;
  success?: string;
};

/** The two steps a student self-reports and staff then verify. */
export type C2LStepNumber = 5 | 6;

/** C2LPHL's public site — used whenever no override is set in cycle_settings. */
export const C2L_DEFAULT_URL = "https://c2lphl.org";

export type C2LStepCopy = {
  /** cycle_settings key holding the outbound URL (admin-editable, may be ""). */
  urlKey: string;
  linkLabel: string;
  instructions: string[];
  checkboxLabel: string;
};

// Instruction lines use the light markup from components/rich-text.tsx
// ([label](url)) so the C2LPHL site can be a real link inside a step.
export const C2L_COPY: Record<C2LStepNumber, C2LStepCopy> = {
  5: {
    urlKey: "c2l_application_url",
    linkLabel: "Open the C2LPHL application",
    instructions: [
      "Go to [c2lphl.org](https://c2lphl.org)",
      "Select “Apply” (or “Log In” if you’ve done C2L before)",
      "Search “Launchpad” under the “Program Name” in the C2L-PHL program locator",
      "Select “Add to selection”",
      "Add two additional programs to your selection (but make sure Launchpad is your top choice)",
      "Hit “Proceed to Application” and enter your information",
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
      "Make sure every document is for the same student name and date of birth you gave us. Your name on your social security number must match your full legal name on your Launchpad Application and C2L-PHL application.",
    ],
    checkboxLabel: "I uploaded my required documents to C2LPHL",
  },
};

export function isC2LStep(n: number): n is C2LStepNumber {
  return n === 5 || n === 6;
}
