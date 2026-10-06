"use client";

import { useActionState, useState } from "react";
import { saveStep3 } from "@/app/(portal)/portal/steps/step3-actions";
import type { Step3Data, Step3Prompt } from "@/utils/step3";
import {
  countWords,
  responseField,
  STEP3_MAX_WORDS,
  STEP3_MIN_WORDS,
  type Step3State,
} from "@/utils/step3-options";
import {
  ActionButton,
  Alert,
  Textarea,
  useStatusFocus,
} from "@/components/forms";

/** One question, with a live count against the required word window. */
function PromptField({
  prompt,
  defaultValue,
  error,
}: {
  prompt: Step3Prompt;
  defaultValue: string;
  error?: string;
}) {
  const [words, setWords] = useState(() => countWords(defaultValue));
  return (
    <Textarea
      label={prompt.prompt}
      name={responseField(prompt.id)}
      rows={8}
      defaultValue={defaultValue}
      error={error}
      onChange={(value) => setWords(countWords(value))}
      hint={`Write ${STEP3_MIN_WORDS}–${STEP3_MAX_WORDS} words. ${
        words > 0
          ? `You're at ${words} ${words === 1 ? "word" : "words"}.`
          : "You can save and come back to this later."
      }`}
    />
  );
}

export function Step3Form({ data }: { data: Step3Data }) {
  const [state, action] = useActionState<Step3State, FormData>(saveStep3, {});
  const err = state.errors;
  const statusRef = useStatusFocus(state);

  if (data.prompts.length === 0) {
    return (
      <div className="rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">Questions coming soon</h2>
        <p>
          The short answer questions for this cycle haven&apos;t been posted
          yet. Nothing is wrong with your application — check back soon.
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={statusRef} tabIndex={-1} className="focus:outline-none">
        {state.success && <Alert tone="success">{state.success}</Alert>}
        {err?.form && <Alert tone="error">{err.form}</Alert>}
        {err && !err.form && (
          <Alert tone="error">
            Please fix the highlighted questions below, then submit again. Your
            answers have been saved.
          </Alert>
        )}
      </div>

      <form action={action} noValidate>
        {data.prompts.map((prompt) => (
          <PromptField
            key={prompt.id}
            prompt={prompt}
            // Answers echoed back by the action win: React 19 resets
            // uncontrolled fields once the action returns.
            defaultValue={state.values?.[prompt.id] ?? prompt.response}
            error={err?.[responseField(prompt.id)]}
          />
        ))}

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          {data.complete ? (
            <ActionButton name="intent" value="save" pendingLabel="Saving…">
              Save changes
            </ActionButton>
          ) : (
            <>
              <ActionButton
                name="intent"
                value="submit"
                pendingLabel="Submitting…"
              >
                Submit Step 3
              </ActionButton>
              <ActionButton
                name="intent"
                value="save"
                variant="secondary"
                pendingLabel="Saving…"
              >
                Save progress
              </ActionButton>
            </>
          )}
        </div>
      </form>
    </>
  );
}
