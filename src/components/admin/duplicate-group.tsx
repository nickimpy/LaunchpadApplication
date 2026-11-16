"use client";

import { useActionState } from "react";
import Link from "next/link";
import { keepDuplicate, dismissDuplicates } from "@/app/(admin)/admin/applicants/archive-actions";
import type { AdminFormState } from "@/app/(admin)/admin/applicants/[id]/actions";
import { Alert } from "@/components/forms";
import { formatDate } from "@/utils/dates";

export type DupCard = {
  applicationId: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  schoolName: string;
  verified: boolean;
  lastSignIn: string | null;
  createdAt: string;
  completedCount: number;
};

/**
 * One group of records that look like the same person, side by side.
 * "Keep this one" archives the others as duplicates of it; "Not the same
 * person" stops suggesting the group. The first card is the best guess at the
 * real record (verified, most progress, newest).
 */
export function DuplicateGroup({ cards }: { cards: DupCard[] }) {
  const ids = cards.map((c) => c.applicationId);
  const [dismissState, dismissAction] = useActionState<AdminFormState, FormData>(dismissDuplicates, {});
  return (
    <section className="mb-9 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold">{cards[0].name}</h2>
      <p className="mb-6 text-xs">
        {cards.length} records with the same date of birth and the same name or phone number.
      </p>
      {dismissState.error && <Alert tone="error">{dismissState.error}</Alert>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c, i) => (
          <Card key={c.applicationId} card={c} ids={ids} suggested={i === 0} />
        ))}
      </div>
      <form action={dismissAction} className="mt-6">
        {ids.map((id) => (
          <input key={id} type="hidden" name="group_ids" value={id} />
        ))}
        <button
          type="submit"
          className="text-xs font-bold text-teal-dark underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark"
        >
          These are different people — stop suggesting them
        </button>
      </form>
    </section>
  );
}

function Card({ card: c, ids, suggested }: { card: DupCard; ids: string[]; suggested: boolean }) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    keepDuplicate.bind(null, c.applicationId),
    {},
  );
  return (
    <div
      className={`rounded-lg border p-3 ${suggested ? "border-teal-dark bg-teal-tint3" : "border-grey-tint2"}`}
    >
      {suggested && <p className="mb-1 text-xs font-bold text-teal-dark">Suggested to keep</p>}
      <dl className="mb-3 text-xs">
        <Row label="Email" value={c.email} />
        <Row label="Phone" value={c.phone ?? "—"} />
        <Row label="Birth date" value={c.dateOfBirth ?? "—"} />
        <Row label="School" value={c.schoolName || "—"} />
        <Row label="Email verified" value={c.verified ? "Yes" : "No — can't log in"} />
        <Row label="Signed up" value={formatDate(c.createdAt)} />
        <Row label="Last login" value={c.lastSignIn ? formatDate(c.lastSignIn) : "Never"} />
        <Row label="Steps complete" value={`${c.completedCount} of 7`} />
      </dl>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <form action={action}>
          {ids.map((id) => (
            <input key={id} type="hidden" name="group_ids" value={id} />
          ))}
          <button
            type="submit"
            className="rounded-md bg-teal-dark px-3 py-1 text-xs font-bold text-white hover:brightness-110
              focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark focus-visible:ring-offset-2"
          >
            Keep this one
          </button>
        </form>
        <Link className="text-xs text-teal-dark underline" href={`/admin/applicants/${c.applicationId}`}>
          Open profile
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt className="font-bold">{label}:</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}
