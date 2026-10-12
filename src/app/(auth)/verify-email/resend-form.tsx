"use client";

import { Turnstile } from "@/components/turnstile";
import { useActionState } from "react";
import { resendVerification, type ResendState } from "./actions";
import { Alert, SubmitButton } from "@/components/forms";

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState<ResendState, FormData>(
    resendVerification,
    {},
  );
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <Turnstile resetOn={state} />
        <SubmitButton pendingLabel="Resending…">
          Resend verification email
        </SubmitButton>
      </form>
    </>
  );
}
