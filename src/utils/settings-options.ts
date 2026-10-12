// The admin Settings page: every cycle setting staff can edit, in one list.
// Shared by the page, the form (client), and the save action — so it lives in
// its own module, never in the "use server" action file (which may only export
// async functions).
//
// Values live in `cycle_settings` (one row per key, per cycle). Step deadlines
// are one jsonb object under `step_deadlines`; the form shows them as 7 dates.

export type SettingKind = "text" | "email" | "url" | "date" | "number" | "longtext";

export type SettingField = {
  key: string;
  label: string;
  kind: SettingKind;
  help?: string;
  /** Long, legally meaningful text: show a stronger warning. */
  legal?: boolean;
};

export type SettingGroup = { title: string; intro?: string; fields: SettingField[] };

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "General",
    fields: [
      {
        key: "contact_email",
        label: "Contact email",
        kind: "email",
        help: "Shown on every step (“Questions? Email …”) and in every email and text.",
      },
      {
        key: "cohort_label",
        label: "Cohort name",
        kind: "text",
        help: "Shown on the portal home: “This is your application for Launchpad’s [cohort] cohort.” e.g. 2027-28",
      },
    ],
  },
  {
    title: "Program dates & eligibility",
    fields: [
      {
        key: "program_start_date",
        label: "Program start date",
        kind: "date",
        help: "Applicants must be the maximum age or younger on this date.",
      },
      {
        key: "max_enrollment_age",
        label: "Maximum age at start",
        kind: "number",
        help: "Older applicants can't create an account. The next two ages are pointed to LiftOff.",
      },
      {
        key: "summer_dates",
        label: "Summer program dates (as written to parents)",
        kind: "text",
        help: "Appears in the parent form question, e.g. “July 6, 2027 to August 12, 2027”.",
      },
      {
        key: "summer_location",
        label: "Summer program location",
        kind: "text",
      },
    ],
  },
  {
    title: "C2LPHL links",
    intro: "Leave blank to use c2lphl.org.",
    fields: [
      { key: "c2l_application_url", label: "Step 5 link (C2LPHL application)", kind: "url" },
      { key: "c2l_documents_url", label: "Step 6 link (C2LPHL documents)", kind: "url" },
    ],
  },
  {
    title: "Parent form",
    fields: [
      {
        key: "program_info_foundations",
        label: "“Learn more about Launchpad” text",
        kind: "longtext",
        help: "Shown to parents who ask to learn more. Leave a blank line between paragraphs. **bold** for bold, [link text](https://…) for links.",
      },
      {
        key: "parent_form_consent_text",
        label: "Records release consent — parent version",
        kind: "longtext",
        legal: true,
      },
      {
        key: "student_release_consent_text",
        label: "Records release consent — 18+ student signing for themselves",
        kind: "longtext",
        legal: true,
      },
    ],
  },
];

export const ALL_SETTING_KEYS = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

/** Form field name for a step deadline. */
export const deadlineField = (step: number) => `deadline_${step}`;

export type SettingsValues = {
  settings: Record<string, string>;
  deadlines: Record<number, string>;
};

export type SettingsState = {
  error?: string;
  errors?: Record<string, string>;
  success?: string;
  /** Echoed back on error — React 19 resets the form after an action. */
  values?: SettingsValues;
};
