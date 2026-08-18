"use client";

import { useActionState, useRef } from "react";
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

  return (
    <form action={action} ref={formRef} className="flex items-center gap-1">
      <select
        name="track"
        defaultValue={track ?? ""}
        aria-label={`Interview track for ${label}`}
        onChange={() => formRef.current?.requestSubmit()}
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
