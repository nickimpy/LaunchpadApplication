import type { NextConfig } from "next";

// Security headers on every response. Deliberately no strict Content-Security-
// Policy yet: Next.js needs inline scripts, and a wrong CSP silently breaks
// pages. These are the low-risk, high-value ones.
const SECURITY_HEADERS = [
  // Nobody may frame the app: stops clickjacking on the signature and consent
  // pages (and the portal can't be iframed into WordPress — use a link).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Don't let browsers guess file types (uploaded documents, PDFs).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only ever see our origin, never a full URL — so a parent-form
  // token in the address bar can't leak through a link to another site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app uses none of these; refuse them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HTTPS only, for two years. (No includeSubDomains: other launchpadphilly.org
  // subdomains aren't ours to commit to HTTPS.)
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Token-bearing parent form: send no referrer at all from these pages.
      { source: "/parent/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  experimental: {
    serverActions: {
      // The parent form (Step 2) posts a canvas signature as a base64 PNG.
      // A real signature compresses to tens of KB, so the 1mb default is
      // already plenty — this just makes the ceiling an explicit decision
      // instead of an unstated default a parent could hit mid-signature.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
