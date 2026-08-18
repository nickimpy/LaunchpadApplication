// Launchpad runs on Philadelphia time, so every timestamp is rendered in that
// zone explicitly. Without a zone, the SAME value renders differently
// depending on where it's rendered: a Server Component formats in the host's
// zone (UTC on Vercel) while a Client Component uses the viewer's browser —
// which is why the admin activity log read as "weird" while staff notes,
// rendered on the client, looked correct.
//
// "America/New_York" rather than a fixed -05:00 offset so daylight saving is
// handled (EST in winter, EDT in summer).

export const PROGRAM_TIME_ZONE = "America/New_York";

/** e.g. "Aug 18, 2026, 1:31 AM EDT" */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    timeZone: PROGRAM_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  });
}

/** e.g. "Aug 18, 2026" */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: PROGRAM_TIME_ZONE,
    dateStyle: "medium",
  });
}
