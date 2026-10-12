import { type NextRequest, NextResponse } from "next/server";
import { runDailyReminders } from "@/utils/notify/triggers";

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

  const origin = new URL(request.url).origin;
  const counts = await runDailyReminders(origin);
  console.log("daily reminders", counts);
  return NextResponse.json({ ok: true, counts });
}
