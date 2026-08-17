import "server-only";
import { headers } from "next/headers";

// Loose shape checks only — this is for an audit trail, not access control, and
// the value has to be valid enough for Postgres's `inet` type or the insert
// hard-errors. Anything unrecognized becomes null (the column is nullable).
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

function sanitize(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (IPV4_RE.test(value)) {
    const octets = value.split(".").map(Number);
    return octets.every((n) => n <= 255) ? value : null;
  }
  // Require a couple of colons so a stray token can't pass as IPv6.
  if (value.includes("::") || value.split(":").length > 2) {
    return IPV6_RE.test(value) ? value : null;
  }
  return null;
}

/**
 * Client IP of the current request, for the parent form's signature record
 * (ESIGN audit trail). Works inside Server Actions — same `headers()` approach
 * as getOrigin(), no NextRequest needed. Vercel's edge network puts the real
 * client IP first in x-forwarded-for.
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    const ip = sanitize(first);
    if (ip) return ip;
  }
  const real = h.get("x-real-ip");
  return real ? sanitize(real) : null;
}
