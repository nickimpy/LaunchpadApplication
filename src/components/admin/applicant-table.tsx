"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import {
  bulkApply,
  BULK_ACTIONS,
  type BulkState,
} from "@/app/(admin)/admin/applicants/bulk-actions";
import { InlineTrack } from "@/components/admin/inline-track";
import { DECISION_OPTIONS } from "@/utils/decision-options";
import type { ApplicantRow } from "@/utils/applicants";
import { STEPS, STATUS_LABELS, type StepStatus } from "@/utils/steps";
import { Alert } from "@/components/forms";

const STATUS_DOT: Record<StepStatus, string> = {
  not_started: "bg-grey-tint2",
  in_progress: "bg-teal-tint2",
  submitted: "bg-teal-dark",
  pending_verification: "bg-teal-tint2",
  needs_attention: "bg-orange",
  complete: "bg-green",
};

function StatusPips({ statuses }: { statuses: Record<number, StepStatus> }) {
  return (
    <span className="flex gap-1">
      {STEPS.map((step) => {
        const status = statuses[step.number] ?? "not_started";
        return (
          <span
            key={step.number}
            title={`Step ${step.number} (${step.name}): ${STATUS_LABELS[status]}`}
            className={`inline-block h-3 w-3 rounded-full ${STATUS_DOT[status]}`}
          >
            <span className="sr-only">
              Step {step.number} {STATUS_LABELS[status]}.
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function ApplicantTable({ rows }: { rows: ApplicantRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState<BulkState, FormData>(
    async (prev, formData) => {
      const result = await bulkApply(prev, formData);
      if (result.success) {
        setSelected([]);
        setConfirming(false);
        setNote("");
      }
      return result;
    },
    {},
  );

  const allShownSelected = rows.length > 0 && selected.length === rows.length;
  const someSelected = selected.length > 0 && !allShownSelected;

  // Shift-click selects the whole range from the last row you clicked, the way
  // Finder and Gmail do — so "first, shift-last" grabs 30 students in two
  // clicks rather than thirty.
  const lastClicked = useRef<number | null>(null);
  const handleRowClick = (index: number, id: string, shiftHeld: boolean) => {
    if (shiftHeld && lastClicked.current !== null && lastClicked.current !== index) {
      const start = Math.min(lastClicked.current, index);
      const end = Math.max(lastClicked.current, index);
      const range = rows.slice(start, end + 1).map((r) => r.applicationId);
      // Union rather than replace, so a shift-click extends an existing
      // selection instead of throwing it away.
      setSelected((s) => Array.from(new Set([...s, ...range])));
    } else {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    }
    lastClicked.current = index;
  };

  const needsNote = action.startsWith("flag_");
  const needsDecision = action === "decision";
  const chosen = BULK_ACTIONS.find((a) => a.value === action);

  return (
    <form action={formAction}>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.skipped && <Alert tone="info">{state.skipped}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}

      {/* Sticky so it stays reachable while scrolling a long list. */}
      {selected.length > 0 && (
        <div
          className="sticky top-0 z-10 mb-3 rounded-lg border border-teal-dark bg-teal-tint3 p-6 shadow-sm"
          role="region"
          aria-label="Bulk actions"
        >
          <p className="mb-3 font-bold">
            {selected.length} applicant{selected.length === 1 ? "" : "s"} selected
          </p>
          {selected.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-bold">Action</span>
              <select
                name="bulk_action"
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setConfirming(false);
                }}
                className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
              >
                <option value="">Choose an action…</option>
                {BULK_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            {needsDecision && (
              <label className="block">
                <span className="block text-xs font-bold">Which decision</span>
                <select
                  name="bulk_decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
                >
                  <option value="">Choose…</option>
                  {DECISION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {(needsNote || needsDecision) && (
            <label className="mt-3 block">
              <span className="block text-xs font-bold">
                {needsNote ? "What's missing (students see this)" : "Internal note (staff only)"}
              </span>
              <textarea
                name="bulk_note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base"
              />
            </label>
          )}

          {/* Two-step confirm: one mis-click shouldn't reclassify a cohort. */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {confirming ? (
              <>
                <span className="text-xs font-bold">
                  Apply &ldquo;{chosen?.label}&rdquo; to {selected.length} applicant
                  {selected.length === 1 ? "" : "s"}?
                </span>
                <button
                  type="submit"
                  className="rounded-md bg-orange px-3 py-3 text-base font-bold text-white
                    hover:brightness-110 focus:outline-none focus-visible:ring-2
                    focus-visible:ring-teal-dark focus-visible:ring-offset-2"
                >
                  Yes, apply it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-xs font-bold text-teal-dark underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!action || (needsDecision && !decision)}
                  onClick={() => setConfirming(true)}
                  className="rounded-md bg-teal-dark px-3 py-3 text-base font-bold text-white
                    hover:brightness-110 focus:outline-none focus-visible:ring-2
                    focus-visible:ring-teal-dark focus-visible:ring-offset-2
                    disabled:opacity-50"
                >
                  Review this change
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-xs font-bold text-teal-dark underline"
                >
                  Clear selection
                </button>
              </>
            )}
          </div>
          <p className="mt-3 text-xs">
            Decisions are only <strong>recorded</strong> here — releasing one to
            a student stays on their individual profile.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-grey-tint2 bg-white shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-base">
          <caption className="sr-only">Applicants, {rows.length} shown</caption>
          <thead>
            <tr className="border-b border-grey-tint2 text-left">
              <th scope="col" className="px-3 py-3">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) =>
                      setSelected(e.target.checked ? rows.map((r) => r.applicationId) : [])
                    }
                    className="h-5 w-5 accent-teal-dark"
                  />
                  <span className="sr-only">
                    Select all {rows.length} applicants matching the current filters
                  </span>
                </label>
              </th>
              <th scope="col" className="px-3 py-3">Name</th>
              <th scope="col" className="px-3 py-3">School</th>
              <th scope="col" className="px-3 py-3">Grad</th>
              <th scope="col" className="px-3 py-3">Program</th>
              <th scope="col" className="px-3 py-3">Track</th>
              <th scope="col" className="px-3 py-3">Steps 1–7</th>
              <th scope="col" className="px-3 py-3">Done</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr
                key={r.applicationId}
                className={`border-b border-grey-tint3 last:border-0 ${
                  selected.includes(r.applicationId) ? "bg-teal-tint3" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(r.applicationId)}
                    onClick={(e) =>
                      handleRowClick(index, r.applicationId, e.shiftKey)
                    }
                    onChange={() => {}}
                    aria-label={`Select ${r.firstName} ${r.lastName}`}
                    className="h-5 w-5 accent-teal-dark"
                  />
                </td>
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <Link
                    className="font-bold text-teal-dark underline"
                    href={`/admin/applicants/${r.applicationId}`}
                  >
                    {r.lastName}, {r.firstName}
                  </Link>
                  {r.preferredName && (
                    <span className="block text-xs">goes by {r.preferredName}</span>
                  )}
                  <span className="block text-xs">{r.email}</span>
                  {r.collegeWarning && (
                    <span className="mt-1 inline-block rounded-full bg-orange-tint3 px-3 py-1 text-xs font-bold text-orange-dark">
                      College plan flagged
                    </span>
                  )}
                </th>
                <td className="px-3 py-3">
                  {r.schoolName || <span className="text-grey-tint1">—</span>}
                  {r.isPartnerSchool && (
                    <span className="block text-xs text-green-dark">Partner school</span>
                  )}
                </td>
                <td className="px-3 py-3">{r.graduationYear ?? "—"}</td>
                <td className="px-3 py-3 capitalize">{r.program ?? "—"}</td>
                <td className="px-3 py-3">
                  <InlineTrack
                    applicationId={r.applicationId}
                    track={r.track}
                    label={`${r.firstName} ${r.lastName}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <StatusPips statuses={r.statuses} />
                </td>
                <td className="px-3 py-3">{r.completedCount}/7</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
