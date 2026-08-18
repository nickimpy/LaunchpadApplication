import "server-only";

// Provider adapters, each behind one interface. The trigger logic and templates
// never learn which vendor is underneath, so switching SMS providers
// (Twilio <-> Zoom Phone) is an env change rather than a rewrite. That matters
// here: which provider Launchpad lands on depends on a Zoom role privilege and
// an A2P registration, neither of which we control.

export type SendResult =
  | { ok: true; id?: string; dryRun?: boolean }
  | { ok: false; error: string };

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type SmsMessage = { to: string; body: string };

/**
 * With no credentials configured, everything still runs and gets logged — it
 * just doesn't leave the building. This is what makes the whole pipeline
 * testable before DNS and carrier registration land.
 */
export const emailDryRun = () => !smtpConfigured() && !process.env.RESEND_API_KEY;

/** Google Workspace SMTP (or any SMTP host). Takes precedence over Resend. */
export const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
export const smsDryRun = () => !smsProvider();

/** Which SMS provider is configured, if any. Twilio wins if both are set. */
export function smsProvider(): "twilio" | "zoom" | null {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return "twilio";
  if (process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_SECRET) return "zoom";
  return null;
}

// ---------------------------------------------------------------------------
// Email — SMTP (Google Workspace)
// ---------------------------------------------------------------------------

/**
 * Sends through an SMTP host. For Launchpad this is Google Workspace, which is
 * already SPF- and DKIM-authorised for launchpadphilly.org — so mail passes
 * authentication with no DNS changes, which matters because the domain's DNS is
 * held by Building 21 rather than by us.
 *
 * `from` may differ from the authenticated user only if that address is a
 * verified send-as alias, or the account is relaying through
 * smtp-relay.gmail.com with a permissive sender policy. Gmail rejects it
 * outright otherwise, which is what the setup test checks.
 */
async function sendViaSmtp(
  message: EmailMessage,
  from: string,
  replyTo?: string,
): Promise<SendResult> {
  try {
    const { createTransport } = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    });
    const info = await transport.sendMail({
      from,
      to: message.to,
      replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true, id: info.messageId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "smtp failed" };
  }
}

// ---------------------------------------------------------------------------
// Email — Resend
// ---------------------------------------------------------------------------

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const from = process.env.EMAIL_FROM ?? "Launchpad Philly <apply@launchpadphilly.org>";
  // Replies should reach a human, not the sending robot — so they go to the
  // apply@ group while mail is sent by a dedicated account.
  const replyTo = process.env.EMAIL_REPLY_TO;

  if (smtpConfigured()) return sendViaSmtp(message, from, replyTo);

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, dryRun: true };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        reply_to: replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Resend ${response.status}: ${await response.text()}` };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "email failed" };
  }
}

// ---------------------------------------------------------------------------
// SMS — Twilio
// ---------------------------------------------------------------------------

async function sendViaTwilio(message: SmsMessage): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_SMS_FROM;
  if (!from) return { ok: false, error: "TWILIO_SMS_FROM is not set" };

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: message.to, From: from, Body: message.body }),
      },
    );
    const data = (await response.json()) as { sid?: string; message?: string };
    if (!response.ok) {
      return { ok: false, error: `Twilio ${response.status}: ${data.message ?? "failed"}` };
    }
    return { ok: true, id: data.sid };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "sms failed" };
  }
}

// ---------------------------------------------------------------------------
// SMS — Zoom Phone
// ---------------------------------------------------------------------------

/** Server-to-Server OAuth token; short-lived, so fetched per send. */
async function zoomToken(): Promise<string | null> {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const secret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !secret) return null;

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      },
    },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function sendViaZoom(message: SmsMessage): Promise<SendResult> {
  const from = process.env.ZOOM_SMS_FROM;
  if (!from) return { ok: false, error: "ZOOM_SMS_FROM is not set" };
  const token = await zoomToken();
  if (!token) return { ok: false, error: "Could not get a Zoom access token" };

  try {
    const response = await fetch("https://api.zoom.us/v2/phone/sms/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { phone_number: from },
        to_members: [{ phone_number: message.to }],
        message: message.body,
      }),
    });
    if (!response.ok) {
      // Error 7639 ("number not permitted to send") shows up even on numbers
      // that look correctly registered, so surface the body rather than hiding
      // it behind a generic message.
      return { ok: false, error: `Zoom ${response.status}: ${await response.text()}` };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "sms failed" };
  }
}

export async function sendSms(message: SmsMessage): Promise<SendResult> {
  switch (smsProvider()) {
    case "twilio":
      return sendViaTwilio(message);
    case "zoom":
      return sendViaZoom(message);
    default:
      return { ok: true, dryRun: true };
  }
}
