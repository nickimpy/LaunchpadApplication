"use client";

import { useState, useTransition } from "react";
import { regenerateParentLink } from "@/app/parent/parent-actions";

/**
 * The copyable parent form link. Rendered both on Step 1 (right after submit)
 * and on Step 2. `onRegenerate` is only offered while Step 2 is still open —
 * rotating the token does not undo a form that's already been signed.
 */
export function ParentLinkBox({
  url,
  allowRegenerate = false,
}: {
  url: string;
  allowRegenerate?: boolean;
}) {
  const [current, setCurrent] = useState(url);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const regenerate = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await regenerateParentLink();
      if (result.url) {
        setCurrent(result.url);
        setCopied(false);
      } else {
        setError(result.error ?? "Couldn't create a new link.");
      }
    });
  };

  return (
    <div className="mb-6 rounded-lg border border-green-dark bg-green-tint3 p-6">
      <h2 className="mb-3 text-lg font-bold">
        Your parent / guardian form link
      </h2>
      <p className="mb-3">
        Share this link with your parent or guardian so they can complete Step 2.
        No account needed. (We&apos;ll also email and text it to them
        automatically once that feature is turned on.)
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          readOnly
          value={current}
          aria-label="Parent form link"
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-base text-grey"
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(current);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="shrink-0 rounded-md bg-teal-dark px-6 py-3 text-base font-bold text-white
            hover:brightness-110 focus:outline-none focus-visible:ring-2
            focus-visible:ring-teal-dark focus-visible:ring-offset-2"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      {allowRegenerate && (
        <div className="mt-3">
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="text-xs font-bold text-teal-dark underline
              focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark
              disabled:opacity-60"
          >
            {pending ? "Creating a new link…" : "Create a new link"}
          </button>
          <p className="mt-1 text-xs">
            Use this if the link went to the wrong person. The old link stops
            working right away.
          </p>
          {error && (
            <p className="mt-1 text-xs font-bold text-orange-dark">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
