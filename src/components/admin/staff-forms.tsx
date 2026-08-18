"use client";

import { useActionState, useState } from "react";
import {
  inviteAdmin,
  setAdminActive,
  type StaffState,
} from "@/app/(admin)/admin/staff/actions";
import { Alert, TextField, SubmitButton } from "@/components/forms";

export function InviteAdminForm() {
  const [state, action] = useActionState<StaffState, FormData>(inviteAdmin, {});
  const [copied, setCopied] = useState(false);

  return (
    <form action={action}>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      {state.inviteLink && (
        <div className="mb-6 rounded-md border-l-4 border-teal-dark bg-teal-tint3 px-3 py-3">
          <p className="mb-3 font-bold">Send them this link to set their password</p>
          <p className="mb-3 text-xs">
            It&apos;s shown once and isn&apos;t stored anywhere. Send it over
            something you trust — anyone holding it can set the password for
            this account. (From Phase 9 onward this gets emailed automatically.)
          </p>
          <input
            readOnly
            value={state.inviteLink}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="One-time staff invite link"
            className="mb-3 w-full rounded-md border border-grey-tint1 bg-white px-3 py-3 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.inviteLink!);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs font-bold
              text-teal-dark hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      )}

      <div className="grid gap-x-6 sm:grid-cols-3">
        <TextField label="First name" name="first_name" optional />
        <TextField label="Last name" name="last_name" optional />
        <TextField label="Email" name="email" type="email" />
      </div>
      <SubmitButton pendingLabel="Adding…">Add staff member</SubmitButton>
    </form>
  );
}

export function ToggleAdminButton({
  adminId,
  active,
  label,
}: {
  adminId: string;
  active: boolean;
  label: string;
}) {
  const [state, action] = useActionState<StaffState, FormData>(
    async () => setAdminActive(adminId, !active),
    {},
  );
  return (
    <form action={action}>
      <button
        type="submit"
        className={`rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs font-bold
          hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
          focus-visible:ring-teal-dark ${active ? "text-orange-dark" : "text-teal-dark"}`}
        aria-label={`${active ? "Revoke access for" : "Restore access for"} ${label}`}
      >
        {active ? "Revoke access" : "Restore access"}
      </button>
      {state.error && (
        <span className="ml-3 text-xs text-orange-dark">{state.error}</span>
      )}
    </form>
  );
}
