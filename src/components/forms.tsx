"use client";

import { type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { NOTIFICATION_PREFERENCES } from "@/utils/validation";

const inputBase =
  "mt-1 block w-full rounded-md border bg-white px-3 py-3 text-base text-grey " +
  "placeholder:text-grey-tint1 focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-teal-dark";

export function TextField({
  label,
  name,
  type = "text",
  error,
  defaultValue,
  autoComplete,
  optional,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  optional?: boolean;
  hint?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className="mb-6">
      <label htmlFor={name} className="block font-bold">
        {label}
        {optional && (
          <span className="font-normal text-grey-tint1"> (optional)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-xs">
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(" ") || undefined
        }
        className={`${inputBase} ${error ? "border-orange-dark" : "border-grey-tint1"}`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-bold text-orange-dark">
          {error}
        </p>
      )}
    </div>
  );
}

const PREFERENCE_LABELS: Record<
  (typeof NOTIFICATION_PREFERENCES)[number],
  string
> = {
  email: "Email only",
  sms: "Text message (SMS) only",
  both: "Both email and text message",
};

export function NotificationPreferenceField({
  error,
  defaultValue = "email",
}: {
  error?: string;
  defaultValue?: string;
}) {
  const errorId = error ? "notification_preference-error" : undefined;
  return (
    <fieldset className="mb-6" aria-describedby={errorId}>
      <legend className="font-bold">
        How should we send you application updates?
      </legend>
      <p className="mt-1 text-xs">
        Important updates about your application arrive this way — you can
        change it any time from your profile.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {NOTIFICATION_PREFERENCES.map((value) => (
          <label key={value} className="flex items-center gap-3">
            <input
              type="radio"
              name="notification_preference"
              value={value}
              defaultChecked={defaultValue === value}
              className="h-6 w-6 accent-teal-dark"
            />
            {PREFERENCE_LABELS[value]}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs font-bold text-orange-dark">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Working…",
}: {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-teal-dark px-3 py-3 text-base font-bold text-white
        hover:brightness-110 focus:outline-none focus-visible:ring-2
        focus-visible:ring-teal-dark focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "border-orange-dark bg-orange-tint3",
    success: "border-green-dark bg-green-tint3",
    info: "border-teal-dark bg-teal-tint3",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-6 rounded-md border-l-4 px-3 py-3 text-base text-grey ${styles[tone]}`}
    >
      {children}
    </div>
  );
}
