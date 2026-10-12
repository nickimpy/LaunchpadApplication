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
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.turnstile),
  );
  const [token, setToken] = useState("");

  // Render once the script is available.
  useEffect(() => {
    if (!SITE_KEY || !ready || !box.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(box.current, {
      sitekey: SITE_KEY,
      // Hidden for most people; shows a simple checkbox only when Cloudflare
      // is unsure. Never a picture puzzle.
      appearance: "interaction-only",
      callback: (t: string) => setToken(t),
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken(""),
    });
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [ready]);

  // Fresh token after each submit (the old one was spent).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (widgetId.current && window.turnstile) {
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
        onReady={() => setReady(true)}
      />
      <div ref={box} className="mb-3" />
      <input type="hidden" name={CAPTCHA_FIELD} value={token} />
    </>
  );
}
