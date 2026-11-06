import { type NextRequest, NextResponse } from "next/server";
import { runDailyReminders } from "@/utils/notify/triggers";
import { SITE_URL } from "@/utils/origin";

// Daily notification run, called by Vercel Cron (see vercel.json) once a day
// around 10am Eastern: sends texts parked overnight by the quiet-hours rule,
// then every reminder that's due (each one at most once per applicant).
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when the
// CRON_SECRET environment variable is set. Without it this route refuses to
// run, so nobody can trigger a reminder blast by visiting the URL.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // NOT the request's own origin: Vercel Cron calls the raw deployment URL
  // (launchpad-application-<hash>-….vercel.app), which sits behind Vercel's
  // login wall. Building links from it sent every reminder to a page
  // applicants couldn't open (found 2026-11-06: 38 reminders affected). Links
  // in scheduled messages always use the public site address.
  const origin = SITE_URL;
  const counts = await runDailyReminders(origin);
  console.log("daily reminders", counts);
  return NextResponse.json({ ok: true, counts });
}
