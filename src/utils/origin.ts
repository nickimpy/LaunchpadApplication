import "server-only";
import { headers } from "next/headers";

// Absolute origin of the current request, for building email redirect links
// (emailRedirectTo / redirectTo). Works in prod (Vercel) and local dev without
// hardcoding a URL.
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
