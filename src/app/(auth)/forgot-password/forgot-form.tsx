"use client";

import { useActionState } from "react";
import { sendPasswordReset, type ResetRequestState } from "./actions";
import { Alert, SubmitButton, TextField } from "@/components/forms";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ResetRequestState, FormData>(
    sendPasswordReset,
    {},
  );
  const values = state.values ?? {};
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success ? (
        <Alert tone="success">{state.success}</Alert>
      ) : (
        <form action={action}>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values.email}
            error={state.error}
          />
          <SubmitButton pendingLabel="Sending…">
            Send reset link
          </SubmitButton>
        </form>
      )}
    </>
  );
}
