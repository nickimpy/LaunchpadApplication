"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";
import {
  Alert,
  NotificationPreferenceField,
  SubmitButton,
  TextField,
} from "@/components/forms";

export type ProfileValues = {
  first_name: string;
  last_name: string;
  preferred_name: string;
  phone: string;
  date_of_birth: string;
  notification_preference: string;
  email: string;
};

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, action] = useActionState<ProfileState, FormData>(
    updateProfile,
    {},
  );

  return (
    <>
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.emailPending && (
        <Alert tone="info">
          To finish changing your email, click the confirmation link we just
          sent to <span className="font-bold">{state.emailPending}</span>. Your
          current email stays active until then.
        </Alert>
      )}
      {state.errors?.form && <Alert tone="error">{state.errors.form}</Alert>}
      <form action={action}>
        <TextField
          label="First name"
          name="first_name"
          autoComplete="given-name"
          defaultValue={initial.first_name}
          error={state.errors?.first_name}
        />
        <TextField
          label="Last name"
          name="last_name"
          autoComplete="family-name"
          defaultValue={initial.last_name}
          error={state.errors?.last_name}
        />
        <TextField
          label="Preferred name"
          name="preferred_name"
          optional
          hint="What you'd like us to call you in messages. We'll use this instead of your first name."
          defaultValue={initial.preferred_name}
          error={state.errors?.preferred_name}
        />
        <TextField
          label="Phone number"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initial.phone}
          error={state.errors?.phone}
        />
        <TextField
          label="Date of birth"
          name="date_of_birth"
          type="date"
          autoComplete="bday"
          defaultValue={initial.date_of_birth}
          error={state.errors?.date_of_birth}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          hint="Changing this sends a confirmation link to your new address."
          defaultValue={initial.email}
          error={state.errors?.email}
        />
        <NotificationPreferenceField
          defaultValue={initial.notification_preference}
          error={state.errors?.notification_preference}
        />
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </form>
    </>
  );
}
