"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { setTrack, type InlineState } from "@/app/(admin)/admin/applicants/table-actions";

/**
 * Track picker that saves on change — no per-row save button to hunt for when
 * you're working down a list of students.
 */
export function InlineTrack({
  applicationId,
  track,
  label,
}: {
  applicationId: string;
  track: string | null;
  label: string;
}) {
  const [state, action] = useActionState<InlineState, FormData>(
    setTrack.bind(null, applicationId),
    {},
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  // Same reset trap as SelectField: React 19 clears the form once the action
  // completes, and a <select> can't be restored from `defaultValue` — its
  // reset baseline is fixed at mount. Track the choice in state and re-assert
  // it after each commit, or the dropdown snaps back to whatever it showed on
  // page load right after saving.
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [value, setValue] = useState(track ?? "");
  const [seed, setSeed] = useState(track ?? "");
  if (seed !== (track ?? "")) {
    setSeed(track ?? "");
    setValue(track ?? "");
  }
  useEffect(() => {
    if (selectRef.current && selectRef.current.value !== value) {
      selectRef.current.value = value;
    }
  });

  return (
    <form action={action} ref={formRef} className="flex items-center gap-1">
      <select
        name="track"
        ref={selectRef}
        defaultValue={track ?? ""}
        aria-label={`Interview track for ${label}`}
        onChange={(e) => {
          setValue(e.target.value);
          formRef.current?.requestSubmit();
        }}
        className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs"
      >
        <option value="">—</option>
        <option value="A">A</option>
        <option value="B">B</option>
      </select>
      {state.saved && (
        <span className="text-xs text-green-dark" role="status">
          Saved
        </span>
      )}
      {state.error && (
        <span className="text-xs text-orange-dark" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
