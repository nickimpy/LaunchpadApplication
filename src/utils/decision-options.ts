// The 8 admissions decision statuses (PRD), matching the decision_status enum.
// Shared by client and server, so no "use server" here.

export const DECISION_OPTIONS = [
  { value: "offer_extended", label: "Offer Extended" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "denied", label: "Denied" },
  { value: "withdrew", label: "Withdrew" },
  { value: "acceptance_rescinded", label: "Acceptance Rescinded" },
  { value: "offer_accepted", label: "Offer Accepted" },
  { value: "offer_not_accepted", label: "Offer Not Accepted" },
  { value: "ineligible", label: "Ineligible" },
] as const;

export const DECISION_VALUES: readonly string[] = DECISION_OPTIONS.map(
  (o) => o.value,
);

export const DECISION_LABELS: Record<string, string> = Object.fromEntries(
  DECISION_OPTIONS.map((o) => [o.value, o.label]),
);

export type DecisionState = {
  error?: string;
  success?: string;
};
