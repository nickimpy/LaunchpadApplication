import "server-only";
import { headers } from "next/headers";

/** The public address applicants use. Override with SITE_URL if it ever moves. */
export const SITE_URL = (process.env.SITE_URL || "https://apply.launchpadphilly.org").replace(/\/$/, "");

// Absolute origin of the current request, for building links in emails and
// auth redirects (emailRedirectTo / redirectTo).
//
// Any *.vercel.app address is replaced with SITE_URL: per-deployment Vercel
// URLs sit behind Vercel's login wall, so a link built from one sends the
// applicant to a page they can't open (and makes them "request access" from
// Vercel). Local dev (localhost) is left alone.
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (host.endsWith(".vercel.app")) return SITE_URL;
  const origin = h.get("origin");
  if (origin && !/\.vercel\.app$/i.test(new URL(origin).host)) return origin;
  if (!host) return SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
