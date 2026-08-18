// Every message in the PRD's notification table, in one place.
//
// Kept free of `server-only` so copy can be unit-rendered and reviewed without
// a database. Cycle-specific values (contact email, deadlines, links) are
// PASSED IN — never hardcoded, per the project conventions.
//
// Two PRD rules are baked into every template that has a next step:
//   1. state a realistic expected timeline, and
//   2. name a contact if they haven't heard back within it.

export type RenderedMessage = {
  template: string;
  subject: string;
  text: string;
  html: string;
  /** Omitted when the message is too long to be a sensible text. */
  sms?: string;
};

export type TemplateContext = {
  /** Preferred name for student-facing copy; legal name is for documents only. */
  firstName: string;
  contactEmail: string;
  portalUrl: string;
};

const BRAND_GREY = "#67686a";
const BRAND_TEAL = "#0a8196";

/** Wraps plain paragraphs in the branded shell used by every email. */
function shell(bodyParagraphs: string[], cta?: { label: string; url: string }): string {
  const paragraphs = bodyParagraphs
    .map(
      (p) =>
        `<p style="margin:0 0 15px;font-size:15px;line-height:1.3;color:${BRAND_GREY}">${p}</p>`,
    )
    .join("");
  const button = cta
    ? `<p style="margin:0 0 15px"><a href="${cta.url}" style="display:inline-block;background:${BRAND_TEAL};color:#ffffff;font-size:15px;font-weight:bold;line-height:1.3;padding:12px 18px;border-radius:6px;text-decoration:none">${cta.label}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:24px">
<tr><td>
<p style="margin:0 0 18px;font-size:18px;font-weight:bold;color:${BRAND_TEAL}">Launchpad Philly</p>
${paragraphs}${button}
</td></tr></table></td></tr></table></body></html>`;
}

const signOff = (contactEmail: string) =>
  `Questions? Just reply to this email or write to ${contactEmail}.`;

// ---------------------------------------------------------------------------
// Student — application progress
// ---------------------------------------------------------------------------

export function startApplicationReminder(ctx: TemplateContext): RenderedMessage {
  const lines = [
    `Hi ${ctx.firstName},`,
    `You created a Launchpad Philly account a week ago but haven't started your application yet — it's still open, and Step 1 takes about 15 minutes.`,
    `You can save your answers part-way through and come back whenever.`,
    signOff(ctx.contactEmail),
  ];
  return {
    template: "start_application_reminder",
    subject: "Ready to start your Launchpad application?",
    text: lines.join("\n\n"),
    html: shell(lines, { label: "Start my application", url: ctx.portalUrl }),
    sms: `Hi ${ctx.firstName}, your Launchpad application is still open and Step 1 takes about 15 min: ${ctx.portalUrl}`,
  };
}

export function stepReminder(
  ctx: TemplateContext,
  step: { number: number; name: string; what: string },
): RenderedMessage {
  const lines = [
    `Hi ${ctx.firstName},`,
    `Nice work finishing Step 1. Step ${step.number} (${step.name}) is still outstanding — ${step.what}`,
    `Everything else you've submitted is saved, so you can pick up where you left off.`,
    signOff(ctx.contactEmail),
  ];
  return {
    template: `step${step.number}_reminder`,
    subject: `One step left: ${step.name}`,
    text: lines.join("\n\n"),
    html: shell(lines, { label: `Finish Step ${step.number}`, url: ctx.portalUrl }),
    sms: `Hi ${ctx.firstName}, Step ${step.number} (${step.name}) is still outstanding on your Launchpad application: ${ctx.portalUrl}`,
  };
}

export function stepComplete(
  ctx: TemplateContext,
  step: { number: number; name: string },
  next: { what: string; timeline: string },
): RenderedMessage {
  const lines = [
    `Hi ${ctx.firstName},`,
    `We've got your Step ${step.number} (${step.name}) — thanks.`,
    `<strong>What happens next:</strong> ${next.what}`,
    `<strong>When:</strong> ${next.timeline}. If you haven't heard from us by then, email ${ctx.contactEmail} and we'll chase it up.`,
  ];
  return {
    template: `step${step.number}_complete`,
    subject: `Step ${step.number} received — ${step.name}`,
    text: lines.join("\n\n").replace(/<\/?strong>/g, ""),
    html: shell(lines, { label: "View my application", url: ctx.portalUrl }),
    sms: `Launchpad: Step ${step.number} (${step.name}) received. ${next.what} ${ctx.portalUrl}`,
  };
}

// ---------------------------------------------------------------------------
// Parent / guardian
// ---------------------------------------------------------------------------

export function parentFormInvite(
  ctx: TemplateContext,
  args: { studentName: string; parentLinkUrl: string },
): RenderedMessage {
  const lines = [
    `Hello,`,
    `${args.studentName} has applied to Launchpad Philly, a free program in Center City that trains young people in technology and entrepreneurship.`,
    `There's one short form we need from a parent or guardian — about five minutes, and <strong>no account or password required</strong>. Your student's details are already filled in.`,
    `This form also gives us permission to request their transcript from their high school, so their application can't move forward without it.`,
    signOff(ctx.contactEmail),
  ];
  return {
    template: "parent_form_invite",
    subject: `A short form for ${args.studentName}'s Launchpad application`,
    text: lines.join("\n\n").replace(/<\/?strong>/g, ""),
    html: shell(lines, { label: "Open the parent form", url: args.parentLinkUrl }),
    sms: `Launchpad Philly: ${args.studentName} applied and needs a parent/guardian form (about 5 min, no login): ${args.parentLinkUrl}`,
  };
}

export function parentFormReminder(
  ctx: TemplateContext,
  args: { studentName: string; parentLinkUrl: string },
): RenderedMessage {
  const lines = [
    `Hello,`,
    `We still need the parent/guardian form for ${args.studentName}'s Launchpad application. It takes about five minutes and needs no account.`,
    `Until it's in, we can't request their transcript, which holds up the rest of their application.`,
    signOff(ctx.contactEmail),
  ];
  return {
    template: "parent_form_reminder",
    subject: `Still needed: parent form for ${args.studentName}`,
    text: lines.join("\n\n"),
    html: shell(lines, { label: "Open the parent form", url: args.parentLinkUrl }),
    sms: `Launchpad Philly: we still need the parent/guardian form for ${args.studentName}: ${args.parentLinkUrl}`,
  };
}

// ---------------------------------------------------------------------------
// Blasts
// ---------------------------------------------------------------------------

export function c2lOpenBlast(
  ctx: TemplateContext,
  args: { c2lUrl: string },
): RenderedMessage {
  const lines = [
    `Hi ${ctx.firstName},`,
    `Applications for Career Connected Learning PHL (C2LPHL) are now open. This is a required part of your Launchpad application — Steps 5 and 6.`,
    `Apply on their site, mark <strong>Launchpad as your top choice</strong>, then come back and report it in your portal. Use the same legal name and date of birth you gave us, or the two systems won't match up.`,
    signOff(ctx.contactEmail),
  ];
  return {
    template: "c2l_open_blast",
    subject: "C2LPHL applications are open — action needed",
    text: lines.join("\n\n").replace(/<\/?strong>/g, ""),
    html: shell(lines, { label: "Go to C2LPHL", url: args.c2lUrl || ctx.portalUrl }),
    sms: `Launchpad: C2LPHL applications are open — required for your application. Mark Launchpad as your top choice, then report it here: ${ctx.portalUrl}`,
  };
}

export function interviewSlotsBlast(ctx: TemplateContext): RenderedMessage {
  const lines = [
    `Hi ${ctx.firstName},`,
    `New interview times are available. Interviews are 30 minutes, and they're the last thing standing between you and a decision.`,
    `Slots are released in batches and do fill up, so book while there's choice.`,
    signOff(ctx.contactEmail),
  ];
  return {
    template: "interview_slots_blast",
    subject: "New Launchpad interview times available",
    text: lines.join("\n\n"),
    html: shell(lines, { label: "Book my interview", url: ctx.portalUrl }),
    sms: `Launchpad: new interview times are available — book yours here: ${ctx.portalUrl}`,
  };
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * Deliberately does NOT contain the decision (PRD): it links to the portal
 * instead, so nobody learns an outcome from a notification preview on a
 * lock screen, and the wording stays neutral for every one of the 8 statuses.
 */
export function decisionReady(ctx: TemplateContext): RenderedMessage {
  const lines = [
    `Hi ${ctx.firstName},`,
    `Your Launchpad Philly admissions decision is ready. You can see it by signing in to your application portal.`,
    `Whatever it says, thank you for the time you put into applying — and if you'd like to talk it through with someone, email ${ctx.contactEmail}.`,
  ];
  return {
    template: "decision_ready",
    subject: "Your Launchpad admissions decision is ready",
    text: lines.join("\n\n"),
    html: shell(lines, { label: "View my decision", url: ctx.portalUrl }),
    sms: `Launchpad Philly: your admissions decision is ready. Sign in to view it: ${ctx.portalUrl}`,
  };
}
