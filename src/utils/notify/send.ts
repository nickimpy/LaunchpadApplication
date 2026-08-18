import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  sendEmail,
  sendSms,
  emailDryRun,
  smsDryRun,
  smsProvider,
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
        provider: channel === "sms" ? smsProvider() : dryRun ? null : "resend",
        error: result.ok ? undefined : result.error,
      },
    });
  };

  if (wantsEmail && recipient.email) {
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
    const dryRun = smsDryRun();
    const result = await sendSms({ to: recipient.phone, body: message.sms });
    await record("sms", recipient.phone, result, dryRun);
  }

  return { sent, failed, dryRun: anyDryRun };
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
