"use client";

import { useActionState } from "react";
import { updatePassword, type ResetPasswordState } from "./actions";
import { Alert, SubmitButton, TextField } from "@/components/forms";

export function ResetPasswordForm() {
  const [state, action] = useActionState<ResetPasswordState, FormData>(
    updatePassword,
    {},
  );
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <form action={action}>
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <TextField
          label="Confirm new password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
        />
        <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
      </form>
    </>
  );
}
