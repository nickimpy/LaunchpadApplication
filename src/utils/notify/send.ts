import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  sendEmail,
  sendSms,
  emailDryRun,
  smsDryRun,
  smsProvider,
  emailProvider,
  toE164,
  type SendResult,
} from "@/utils/notify/providers";
import type { RenderedMessage } from "@/utils/notify/templates";

export type Recipient = {
  studentId?: string | null;
  applicationId?: string | null;
  email?: string | null;
  phone?: string | null;
  /** email | sms | both. Students cannot opt out entirely (PRD). */
  preference?: string | null;
};

/**
 * Sends a rendered message on whichever channels the recipient has asked for,
 * and writes one `notification_log` row per attempt.
 *
 * Uses the service-role client: notifications fire from server actions and from
 * the reminder cron, where there is no user session, and `notification_log` is
 * admin-only under RLS.
 *
 * Never throws. A failed send must not roll back the thing that triggered it —
 * a student who submits Step 1 is submitted whether or not the parent email
 * goes out. Failures land in the log with status 'failed' for staff to see.
 */
export async function notify(
  recipient: Recipient,
  message: RenderedMessage,
  triggerEvent: string,
): Promise<{ sent: number; failed: number; dryRun: boolean }> {
  const supabase = createAdminClient();
  const preference = recipient.preference ?? "email";
  const wantsEmail = preference === "email" || preference === "both";
  const wantsSms = preference === "sms" || preference === "both";

  let sent = 0;
  let failed = 0;
  let anyDryRun = false;

  const record = async (
    channel: "email" | "sms",
    to: string,
    result: SendResult,
    dryRun: boolean,
  ) => {
    if (dryRun) anyDryRun = true;
    if (result.ok) sent += 1;
    else failed += 1;

    await supabase.from("notification_log").insert({
      student_id: recipient.studentId ?? null,
      application_id: recipient.applicationId ?? null,
      recipient: to,
      channel,
      template: message.template,
      trigger_event: triggerEvent,
      // 'dry_run' is a first-class status so staff can tell "we chose not to
      // send yet" apart from "we tried and it broke".
      status: dryRun ? "dry_run" : result.ok ? "sent" : "failed",
      payload: {
        subject: channel === "email" ? message.subject : undefined,
        body: channel === "email" ? message.text : message.sms,
        provider: dryRun ? null : channel === "sms" ? smsProvider() : emailProvider(),
        error: result.ok ? undefined : result.error,
      },
    });
  };

  if (wantsEmail && recipient.email && (await capped("email", recipient.email))) {
    await logCapped("email", recipient.email);
  } else if (wantsEmail && recipient.email) {
    const dryRun = emailDryRun();
    const result = await sendEmail({
      to: recipient.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    await record("email", recipient.email, result, dryRun);
  }

  // Only send an SMS when the template actually has one — several messages are
  // too long to be a sensible text and are email-only by design.
  if (wantsSms && recipient.phone && message.sms) {
    const to = toE164(recipient.phone);
    if (!to) {
      await record(
        "sms",
        recipient.phone,
        { ok: false, error: "Not a valid US phone number — text skipped" },
        false,
      );
    } else if (await capped("sms", to)) {
      await logCapped("sms", to);
    } else if (inSmsQuietHours()) {
      // Texts only go out 9am–8pm Eastern. Park it; the morning cron run sends
      // every deferred text (see sendDeferredSms).
      await supabase.from("notification_log").insert({
        student_id: recipient.studentId ?? null,
        application_id: recipient.applicationId ?? null,
        recipient: to,
        channel: "sms",
        template: message.template,
        trigger_event: triggerEvent,
        status: "deferred",
        payload: { body: message.sms },
      });
    } else {
      const dryRun = smsDryRun();
      const result = await sendSms({ to, body: message.sms });
      await record("sms", to, result, dryRun);
    }
  }

  return { sent, failed, dryRun: anyDryRun };

  async function logCapped(channel: "email" | "sms", to: string) {
    failed += 1;
    await supabase.from("notification_log").insert({
      student_id: recipient.studentId ?? null,
      application_id: recipient.applicationId ?? null,
      recipient: to,
      channel,
      template: message.template,
      trigger_event: triggerEvent,
      status: "capped",
      payload: { error: "Skipped: daily sending limit reached (anti-spam safety cap)" },
    });
  }
}

// ---------------------------------------------------------------------------
// Anti-abuse caps
// ---------------------------------------------------------------------------
// Normal use never comes near these: a single applicant gets a handful of
// messages across the whole cycle. They exist so a bug, a bot, or someone
// typing a stranger's number as their "parent" can't turn Launchpad's sender
// into a spam cannon or run up the Twilio bill. Capped sends are logged (status
// 'capped') so staff can see them on the profile.

/** Max messages to ONE phone / inbox in 24 hours. */
const PER_RECIPIENT_DAILY = { email: 8, sms: 5 } as const;

/** Max texts across the whole app in 24 hours (override with SMS_DAILY_CAP). */
const GLOBAL_SMS_DAILY = Number(process.env.SMS_DAILY_CAP ?? 400);

async function capped(channel: "email" | "sms", to: string): Promise<boolean> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const counted = ["sent", "dry_run", "deferred"];

  const { count: toRecipient } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("channel", channel)
    .eq("recipient", to)
    .in("status", counted)
    .gte("sent_at", since);
  if ((toRecipient ?? 0) >= PER_RECIPIENT_DAILY[channel]) return true;

  if (channel === "sms") {
    const { count: allSms } = await supabase
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("channel", "sms")
      .in("status", counted)
      .gte("sent_at", since);
    if ((allSms ?? 0) >= GLOBAL_SMS_DAILY) {
      console.error("GLOBAL SMS CAP REACHED — texts are being skipped", { cap: GLOBAL_SMS_DAILY });
      return true;
    }
  }
  return false;
}

/**
 * Has this exact message already gone to this application for this trigger?
 * Reminders run on a schedule, so without this a nightly cron would re-send the
 * same nudge every night until the student acted.
 */
export async function alreadySent(
  applicationId: string,
  triggerEvent: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notification_log")
    .select("id")
    .eq("application_id", applicationId)
    .eq("trigger_event", triggerEvent)
    .not("status", "eq", "failed")
    .limit(1);
  return Boolean(data?.length);
}

/** True outside 9am–8pm in Philadelphia (America/New_York, DST-aware). */
export function inSmsQuietHours(now: Date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/New_York",
    }).format(now),
  );
  return hour < 9 || hour >= 20;
}

/**
 * Sends every text that was parked during quiet hours. Run by the morning
 * cron. Each row is updated in place to sent/failed so it's never sent twice.
 */
export async function sendDeferredSms(): Promise<{ sent: number; failed: number }> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("notification_log")
    .select("id, recipient, payload")
    .eq("channel", "sms")
    .eq("status", "deferred")
    .limit(500);

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const body = (row.payload as { body?: string } | null)?.body;
    if (!body) continue;
    const dryRun = smsDryRun();
    const result = await sendSms({ to: row.recipient as string, body });
    if (result.ok) sent += 1;
    else failed += 1;
    await supabase
      .from("notification_log")
      .update({
        status: dryRun ? "dry_run" : result.ok ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        payload: {
          ...(row.payload as object),
          provider: dryRun ? null : smsProvider(),
          error: result.ok ? undefined : result.error,
        },
      })
      .eq("id", row.id as number);
  }
  return { sent, failed };
}
