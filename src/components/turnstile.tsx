"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

// Cloudflare Turnstile bot check for the auth forms (signup, login, magic
// link, password reset, resend verification). Supabase verifies the token when
// "Bot and Abuse Protection" is switched on in its dashboard.
//
// INERT until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set in Vercel: with no key it
// renders nothing and the forms send no token, which is exactly right while
// Supabase's CAPTCHA setting is off. Rollout order (CLAUDE.md): add the site key
// in Vercel → redeploy → THEN turn CAPTCHA on in Supabase with the secret key.
// Turning Supabase on first would reject every login and signup.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Form field the token travels in; read by the auth server actions. */
export const CAPTCHA_FIELD = "captcha_token";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Drop inside a <form>. Pass the form's action state as `resetOn`: tokens are
 * single-use, so after every submit the widget fetches a fresh one.
 */
export function Turnstile({ resetOn }: { resetOn?: unknown }) {
  const box = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const tokenRef = useRef("");
  // A submit the person made before the check finished — replayed once it does.
  const pending = useRef<HTMLElement | null | undefined>(undefined);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "waiting" | "stuck">("idle");

  const applyToken = (t: string) => {
    tokenRef.current = t;
    // Write the DOM too: a replayed submit below happens before React re-renders.
    if (input.current) input.current.value = t;
    setToken(t);
    if (t && pending.current !== undefined) {
      const submitter = pending.current;
      pending.current = undefined;
      setStatus("idle");
      const form = box.current?.closest("form");
      form?.requestSubmit(submitter instanceof HTMLButtonElement ? submitter : undefined);
    }
  };

  // Render as soon as Cloudflare's script is available. Polls rather than
  // relying on next/script's onReady, which never fired in the production
  // build (found 2026-10-12: the script loaded but no widget was drawn).
  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    let tries = 0;
    const tryRender = () => {
      if (cancelled || widgetId.current || !box.current) return;
      if (!window.turnstile) {
        if (tries++ < 100) setTimeout(tryRender, 100); // up to ~10s
        return;
      }
      widgetId.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        // Hidden for most people; shows a simple checkbox only when
        // Cloudflare is unsure. Never a picture puzzle.
        appearance: "interaction-only",
        // Match the white form card (it otherwise follows the OS dark mode).
        theme: "light",
        callback: (t: string) => applyToken(t),
        "expired-callback": () => applyToken(""),
        "error-callback": () => applyToken(""),
      });
    };
    tryRender();
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  // Don't let the form go before the check is done. The check usually takes
  // a second or two and is invisible, so people click straight away — that
  // used to send no token and fail with "couldn't confirm you're a person"
  // (found 2026-10-12). Instead: hold the submit, say so, and send it
  // automatically the moment the token arrives. Capture phase on the form, so
  // React's form action never sees the held submit.
  useEffect(() => {
    if (!SITE_KEY) return;
    const form = box.current?.closest("form");
    if (!form) return;
    let stuckTimer: ReturnType<typeof setTimeout> | undefined;
    const onSubmit = (e: SubmitEvent) => {
      if (tokenRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pending.current = e.submitter ?? null;
      setStatus("waiting");
      clearTimeout(stuckTimer);
      // If Cloudflare wants a click, its checkbox is now showing above.
      stuckTimer = setTimeout(() => {
        if (pending.current !== undefined) setStatus("stuck");
      }, 12000);
    };
    form.addEventListener("submit", onSubmit, { capture: true });
    return () => {
      form.removeEventListener("submit", onSubmit, { capture: true });
      clearTimeout(stuckTimer);
    };
  }, []);

  // Fresh token after each submit (the old one was spent).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (widgetId.current && window.turnstile) {
      tokenRef.current = "";
      setToken("");
      window.turnstile.reset(widgetId.current);
    }
  }, [resetOn]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={box} className="mb-3" />
      <p role="status" aria-live="polite" className="mb-3 text-xs empty:hidden">
        {status === "waiting"
          ? "One moment — finishing a quick security check…"
          : status === "stuck"
            ? "The security check is taking a while. If a checkbox appeared above, tick it; otherwise refresh the page and try again."
            : ""}
      </p>
      <input ref={input} type="hidden" name={CAPTCHA_FIELD} value={token} readOnly />
    </>
  );
}
