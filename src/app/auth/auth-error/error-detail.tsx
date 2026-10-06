"use client";

import { useSyncExternalStore } from "react";

// The URL hash is external browser state, so it's read through
// useSyncExternalStore rather than an effect — hydration stays consistent
// (the server has no hash to render) without cascading renders.
const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const getSnapshot = () => window.location.hash;
const getServerSnapshot = () => "";

/**
 * Supabase reports auth link failures in the URL *hash*, which never reaches
 * the server — so the explanation has to be worked out in the browser.
 *
 * The common case by far is `otp_expired` on a link the applicant really did
 * click: mail providers (Gmail especially) prefetch links to scan them, which
 * spends the one-time token and confirms the address seconds after signup.
 * The verification genuinely succeeded; only the human's click fails. Telling
 * them "this link didn't work" sends an already-verified applicant off to
 * request links they don't need.
 */
export function AuthErrorDetail() {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const code = new URLSearchParams(hash.replace(/^#/, "")).get("error_code");

  if (code === "otp_expired" || code === "access_denied") {
    return (
      <>
        <h1 className="mb-3 text-xl font-bold">
          Your email may already be confirmed
        </h1>
        <p className="mb-3">
          Verification links can only be opened once, and some email apps open
          them automatically to check they&apos;re safe. If that happened,
          you&apos;re already verified — <strong>try logging in first.</strong>
        </p>
        <p className="mb-6">
          If logging in says your email isn&apos;t confirmed yet, request a
          fresh link below.
        </p>
      </>
    );
  }

  // No recognised error code (e.g. the link was opened in a different browser
  // than the one that started signup). Same advice: the address is very likely
  // confirmed already, so logging in comes before requesting anything new.
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">
        We couldn&apos;t sign you in from that link
      </h1>
      <p className="mb-3">
        If you just confirmed your email, you&apos;re all set —{" "}
        <strong>try logging in first.</strong>
      </p>
      <p className="mb-6">
        If logging in says your email isn&apos;t confirmed yet, or the link
        expired, request a fresh one below.
      </p>
    </>
  );
}
