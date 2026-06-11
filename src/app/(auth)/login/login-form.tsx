"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, sendMagicLink, type LoginState, type MagicLinkState } from "./actions";
import { Alert, SubmitButton, TextField } from "@/components/forms";

function PasswordPanel() {
  const [state, action] = useActionState<LoginState, FormData>(login, {});
  const values = state.values ?? {};
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <form action={action}>
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={values.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <div className="mb-6 -mt-3 text-base">
          <Link
            href="/forgot-password"
            className="font-bold text-teal-dark underline"
          >
            Forgot your password?
          </Link>
        </div>
        <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      </form>
    </>
  );
}

function MagicLinkPanel() {
  const [state, action] = useActionState<MagicLinkState, FormData>(
    sendMagicLink,
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
          <p className="mb-6">
            We&apos;ll email you a link that logs you in — no password needed.
          </p>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values.email}
          />
          <SubmitButton pendingLabel="Sending link…">
            Email me a magic link
          </SubmitButton>
        </form>
      )}
    </>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const tabBase =
    "flex-1 rounded-md px-3 py-3 text-base font-bold focus:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-teal-dark";
  return (
    <>
      <div
        role="tablist"
        aria-label="Choose how to log in"
        className="mb-6 flex gap-3"
      >
        <button
          role="tab"
          type="button"
          aria-selected={mode === "password"}
          onClick={() => setMode("password")}
          className={`${tabBase} ${
            mode === "password"
              ? "bg-teal-dark text-white"
              : "bg-grey-tint3 text-grey"
          }`}
        >
          Password
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={mode === "magic"}
          onClick={() => setMode("magic")}
          className={`${tabBase} ${
            mode === "magic"
              ? "bg-teal-dark text-white"
              : "bg-grey-tint3 text-grey"
          }`}
        >
          Magic link
        </button>
      </div>
      {mode === "password" ? <PasswordPanel /> : <MagicLinkPanel />}
    </>
  );
}
