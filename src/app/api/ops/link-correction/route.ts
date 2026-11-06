import { type NextRequest, NextResponse } from "next/server";
import { sendLinkCorrections } from "@/utils/notify/triggers";
import { SITE_URL } from "@/utils/origin";

// One-off operations endpoint: sends the Nov 2026 broken-link corrections.
// Locked unless OPS_TOKEN is set in Vercel, and then only with that exact
// bearer token. `?dry=1` reports who WOULD be messaged without sending.
// Remove OPS_TOKEN afterwards and the endpoint is inert again.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = process.env.OPS_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";
  const result = await sendLinkCorrections(SITE_URL, dryRun);
  console.log("link corrections", result);
  return NextResponse.json({ ok: true, ...result });
}
