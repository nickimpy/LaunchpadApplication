// Shared by the bulk-actions server action and the applicant table (a client
// component). Must NOT live in bulk-actions.ts: a "use server" file may only
// export async functions, and anything else exported from one turns into a
// server-action reference on the client — `BULK_ACTIONS.find` then throws and
// the whole applicants page fails to load.

export type BulkState = {
  error?: string;
  success?: string;
  /** Rows the action didn't apply to, so nothing looks silently dropped. */
  skipped?: string;
};

/** Everything staff can do to a batch at once. */
export const BULK_ACTIONS = [
  { value: "verify_5", label: "Mark C2L Step 5 verified" },
  { value: "verify_6", label: "Mark C2L Step 6 verified" },
  { value: "flag_5", label: "Flag C2L Step 5 incomplete" },
  { value: "flag_6", label: "Flag C2L Step 6 incomplete" },
  { value: "decision", label: "Record a decision" },
] as const;
