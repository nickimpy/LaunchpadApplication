"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/(admin)/admin/settings/actions";
import {
  SETTING_GROUPS,
  deadlineField,
  type SettingField,
  type SettingsState,
  type SettingsValues,
} from "@/utils/settings-options";
import { STEPS } from "@/utils/steps";
import { Alert, SubmitButton, useStatusFocus } from "@/components/forms";

const INPUT =
  "mt-1 block w-full rounded-md border bg-white px-3 py-3 text-base text-grey " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark";

function Field({
  f,
  value,
  error,
}: {
  f: SettingField;
  value: string;
  error?: string;
}) {
  const id = `setting-${f.key}`;
  const describedBy = [f.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const border = error ? "border-orange-dark" : "border-grey-tint1";
  return (
    <div className="mb-6">
      <label htmlFor={id} className="block font-bold">
        {f.label}
      </label>
      {f.legal && (
        <p className="mt-1 text-xs font-bold text-orange-dark">
          Legal wording — have it reviewed before changing. Forms already signed
          keep the exact text they agreed to; only new signers see the change.
        </p>
      )}
      {f.help && (
        <p id={`${id}-help`} className="mt-1 text-xs">
          {f.help}
        </p>
      )}
      {f.kind === "longtext" ? (
        <textarea
          id={id}
          name={f.key}
          defaultValue={value}
          rows={f.legal ? 8 : 12}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT} ${border}`}
        />
      ) : (
        <input
          id={id}
          name={f.key}
          type={f.kind === "number" ? "number" : f.kind === "url" ? "url" : f.kind === "email" ? "email" : f.kind === "date" ? "date" : "text"}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT} ${border}`}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-bold text-orange-dark">
          {error}
        </p>
      )}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSettings, {});
  const statusRef = useStatusFocus(state);
  // Echoed values win: React 19 resets the form after an action returns.
  const values = state.values ?? initial;
  const err = state.errors ?? {};

  return (
    <form action={action} noValidate>
      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {state.success && <Alert tone="success">{state.success}</Alert>}
        {state.error && <Alert tone="error">{state.error}</Alert>}
      </div>

      {SETTING_GROUPS.map((group) => (
        <fieldset
          key={group.title}
          className="mb-9 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm"
        >
          <legend className="px-1 text-lg font-bold">{group.title}</legend>
          {group.intro && <p className="mb-6 text-xs">{group.intro}</p>}
          {group.fields.map((f) => (
            <Field key={f.key} f={f} value={values.settings[f.key] ?? ""} error={err[f.key]} />
          ))}
        </fieldset>
      ))}

      <fieldset className="mb-9 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <legend className="px-1 text-lg font-bold">Step due dates</legend>
        <p className="mb-6 text-xs">
          Shown on every step and in reminder emails and texts (sent a week
          before each date). Leave blank for “No deadline set yet”.
        </p>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {STEPS.map((step) => {
            const name = deadlineField(step.number);
            const error = err[name];
            return (
              <div key={step.number} className="mb-6">
                <label htmlFor={name} className="block font-bold">
                  {step.number}. {step.name}
                </label>
                <input
                  id={name}
                  name={name}
                  type="date"
                  defaultValue={values.deadlines[step.number] ?? ""}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${name}-error` : undefined}
                  className={`${INPUT} ${error ? "border-orange-dark" : "border-grey-tint1"}`}
                />
                {error && (
                  <p id={`${name}-error`} className="mt-1 text-xs font-bold text-orange-dark">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="max-w-xs">
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
