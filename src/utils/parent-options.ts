// Step 2 (parent form) option lists and state type, shared by the client form
// and the server action — same split as step1-options.ts. Values match the
// availability_answer / iep_answer Postgres enums exactly.

import type { FieldErrors } from "@/utils/validation";

export type ParentFormState = {
  errors?: FieldErrors;
  success?: string;
  /** Set once the form is stored, so the client swaps to the thank-you panel. */
  submitted?: boolean;
};

export const WANTS_INFO_OPTIONS = [
  { value: "yes", label: "Yes, please!" },
  { value: "no", label: "No thanks, take me to the form" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
] as const;

export const AVAILABILITY_VALUES = AVAILABILITY_OPTIONS.map((o) => o.value);

export const IEP_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "prefer_not_to_disclose", label: "Prefer not to disclose" },
] as const;

export const IEP_VALUES = IEP_OPTIONS.map((o) => o.value);
