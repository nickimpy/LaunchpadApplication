// Document types for admin uploads. Lives here, NOT in the "use server"
// action file: those modules may only export async functions, and a plain
// array exported from one becomes a server-action reference on the client —
// which fails at runtime with "map is not a function", not at build time.
// (Same reason step1-options.ts exists separately from step1-actions.ts.)

/** Mirrors the documents.doc_type check constraint. */
export const DOC_TYPES = [
  { value: "transcript", label: "Transcript" },
  { value: "attendance", label: "Attendance record" },
  { value: "iep_504", label: "IEP / 504 plan" },
  { value: "other", label: "Other" },
] as const;
