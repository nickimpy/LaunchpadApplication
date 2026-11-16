// Archive reasons + applicant-list views. Shared by server actions and client
// components, so this stays free of `server-only` and is NOT a "use server" file.

export const ARCHIVE_REASONS = [
  { value: "withdrew", label: "Withdrew / no longer interested" },
  { value: "ineligible", label: "Ineligible" },
  { value: "test_spam", label: "Test or spam account" },
  { value: "duplicate", label: "Duplicate application" },
  { value: "never_verified", label: "Never verified their email" },
  { value: "other", label: "Other" },
] as const;

export type ArchiveReason = (typeof ARCHIVE_REASONS)[number]["value"];

export const ARCHIVE_REASON_LABELS: Record<string, string> = Object.fromEntries(
  ARCHIVE_REASONS.map((r) => [r.value, r.label]),
);

/**
 * Reasons staff pick on a profile. "duplicate" goes through the Possible
 * duplicates screen (it needs the application being kept); "never_verified" is
 * set automatically after 30 days.
 */
export const STAFF_ARCHIVE_REASONS = ARCHIVE_REASONS.filter(
  (r) => r.value !== "duplicate" && r.value !== "never_verified",
);

/** Which applicants the list (and CSV) shows. Default = the active pipeline. */
export const APPLICANT_VIEWS = [
  { value: "", label: "Active applicants" },
  { value: "unverified", label: "Unverified signups" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "Everyone" },
] as const;

/** Auto-archive accounts that never verified their email after this many days. */
export const UNVERIFIED_ARCHIVE_DAYS = 30;
