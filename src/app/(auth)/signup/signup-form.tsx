"use client";

import { useActionState } from "react";
import { signup, type SignupState } from "./actions";
import {
  sendPasswordReset,
  type ResetRequestState,
} from "../forgot-password/actions";
import {
  Alert,
  NotificationPreferenceField,
  SubmitButton,
  TextField,
} from "@/components/forms";

// Shown when the email already has an account (PRD: Account Creation).
// Lives outside the signup <form> because forms can't nest.
function DuplicateAccountNotice({ email }: { email: string }) {
  const [state, action] = useActionState<ResetRequestState, FormData>(
    sendPasswordReset,
    {},
  );
  return (
    <Alert tone="error">
      {state.success ? (
        <p>{state.success}</p>
      ) : (
        <form action={action}>
          <input type="hidden" name="email" value={email} />
          <p>
            An account with that email already exists,{" "}
            <button
              type="submit"
              className="font-bold text-teal-dark underline focus:outline-none
                focus-visible:ring-2 focus-visible:ring-teal-dark"
            >
              click here to reset your password
            </button>
            .
          </p>
          {state.error && <p className="mt-1 font-bold">{state.error}</p>}
        </form>
      )}
    </Alert>
  );
}

export function SignupForm() {
  const [state, action] = useActionState<SignupState, FormData>(signup, {});
  const values = state.values ?? {};

  return (
    <>
      {state.duplicate && (
        <DuplicateAccountNotice email={values.email ?? ""} />
      )}
      {state.errors?.form && <Alert tone="error">{state.errors.form}</Alert>}
      <form action={action}>
        <TextField
          label="First name"
          name="first_name"
          autoComplete="given-name"
          defaultValue={values.first_name}
          error={state.errors?.first_name}
        />
        <TextField
          label="Last name"
          name="last_name"
          autoComplete="family-name"
          defaultValue={values.last_name}
          error={state.errors?.last_name}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          hint="We'll send a verification link here."
          defaultValue={values.email}
          error={state.errors?.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={state.errors?.password}
        />
        <TextField
          label="Date of birth"
          name="date_of_birth"
          type="date"
          autoComplete="bday"
          defaultValue={values.date_of_birth}
          error={state.errors?.date_of_birth}
        />
        <TextField
          label="Phone number"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={values.phone}
          error={state.errors?.phone}
        />
        <NotificationPreferenceField
          defaultValue={values.notification_preference}
          error={state.errors?.notification_preference}
        />
        <SubmitButton pendingLabel="Creating your account…">
          Create account
        </SubmitButton>
      </form>
    </>
  );
}
