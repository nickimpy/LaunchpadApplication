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
  readOnly,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  optional?: boolean;
  hint?: string;
  readOnly?: boolean;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className="mb-6">
      <label htmlFor={name} className="block font-bold">
        {label}
        {optional && !readOnly && (
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
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(" ") || undefined
        }
        className={`${inputBase} ${readOnly ? "bg-grey-tint4 text-grey-tint1" : ""} ${error ? "border-orange-dark" : "border-grey-tint1"}`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-bold text-orange-dark">
          {error}
        </p>
      )}
    </div>
  );
}

type Option = { value: string; label: string };

/** Normalize a string[] or {value,label}[] into Option[]. */
function toOptions(options: readonly (string | Option)[]): Option[] {
  return options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-bold text-orange-dark">
      {message}
    </p>
  );
}

export function SelectField({
  label,
  name,
  options,
  error,
  defaultValue,
  autoComplete,
  optional,
  hint,
  placeholder = "Select an option…",
  onChange,
}: {
  label: string;
  name: string;
  options: readonly (string | Option)[];
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
  optional?: boolean;
  hint?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
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
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        autoComplete={autoComplete}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(" ") || undefined
        }
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`${inputBase} ${error ? "border-orange-dark" : "border-grey-tint1"}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {toOptions(options).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function RadioGroup({
  legend,
  name,
  options,
  error,
  defaultValue,
  optional,
  hint,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly (string | Option)[];
  error?: string;
  defaultValue?: string;
  optional?: boolean;
  hint?: string;
  onChange?: (value: string) => void;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <fieldset
      className="mb-6"
      aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
    >
      <legend className="font-bold">
        {legend}
        {optional && (
          <span className="font-normal text-grey-tint1"> (optional)</span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="mt-1 text-xs">
          {hint}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-3">
        {toOptions(options).map((o) => (
          <label key={o.value} className="flex items-start gap-3">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              required={!optional}
              onChange={onChange ? () => onChange(o.value) : undefined}
              className="mt-1 h-5 w-5 shrink-0 accent-teal-dark"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

export function CheckboxGroup({
  legend,
  name,
  options,
  error,
  defaultValues = [],
  hint,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly (string | Option)[];
  error?: string;
  defaultValues?: string[];
  hint?: string;
  onChange?: (values: string[]) => void;
}) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <fieldset
      className="mb-6"
      aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
    >
      <legend className="font-bold">{legend}</legend>
      {hint && (
        <p id={hintId} className="mt-1 text-xs">
          {hint}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-3">
        {toOptions(options).map((o) => (
          <label key={o.value} className="flex items-start gap-3">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              onChange={
                onChange
                  ? (e) => {
                      const checked = e.currentTarget.checked;
                      const next = checked
                        ? [...defaultValues, o.value]
                        : defaultValues.filter((v) => v !== o.value);
                      // Read live state from the DOM so callers get the
                      // current selection regardless of stale props.
                      const form = e.currentTarget.form;
                      if (form) {
                        const live = Array.from(
                          form.querySelectorAll<HTMLInputElement>(
                            `input[name="${name}"]:checked`,
                          ),
                        ).map((el) => el.value);
                        onChange(live);
                      } else {
                        onChange(next);
                      }
                    }
                  : undefined
              }
              className="mt-1 h-5 w-5 shrink-0 accent-teal-dark"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

export function Textarea({
  label,
  name,
  error,
  defaultValue,
  optional,
  hint,
  rows = 4,
  onChange,
}: {
  label: string;
  name: string;
  error?: string;
  defaultValue?: string;
  optional?: boolean;
  hint?: string;
  rows?: number;
  onChange?: (value: string) => void;
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
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        required={!optional}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [errorId, hintId].filter(Boolean).join(" ") || undefined
        }
        className={`${inputBase} ${error ? "border-orange-dark" : "border-grey-tint1"}`}
      />
      <FieldError id={errorId} message={error} />
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

/**
 * Submit button that can carry a name/value (so a form with more than one
 * submit — e.g. "Save progress" vs "Submit" — can tell which was clicked) and
 * a primary/secondary style. Disabled while the form action is pending.
 */
export function ActionButton({
  children,
  name,
  value,
  variant = "primary",
  pendingLabel,
}: {
  children: ReactNode;
  name?: string;
  value?: string;
  variant?: "primary" | "secondary";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-teal-dark text-white hover:brightness-110"
      : "border border-grey-tint1 bg-white text-teal-dark hover:bg-grey-tint4";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`w-full rounded-md px-3 py-3 text-base font-bold focus:outline-none
        focus-visible:ring-2 focus-visible:ring-teal-dark focus-visible:ring-offset-2
        disabled:opacity-60 sm:w-auto sm:min-w-44 ${styles}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
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
