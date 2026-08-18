import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { formatDateTime } from "@/utils/dates";
import { AVAILABILITY_OPTIONS, IEP_OPTIONS } from "@/utils/parent-options";

// Pure rendering, deliberately free of `server-only`, Supabase, and cookies:
// this document goes to schools on Launchpad letterhead, so being able to
// render it in a test script and actually look at it is worth the split.

/** Everything the document needs, already fetched. */
export type ReleaseData = {
  applicationId: string;
  student: {
    firstName: string | null;
    lastName: string | null;
    preferredName: string | null;
    dateOfBirth: string | null;
  };
  schoolName: string;
  parent: {
    firstName: string | null;
    lastName: string | null;
    relationship: string | null;
    email: string | null;
    phone: string | null;
  };
  consentText: string;
  signaturePng: ArrayBuffer | null;
  signatureTypedName: string | null;
  signedAt: string;
  signerIp: string | null;
  availability: string | null;
  availabilityConcerns: string | null;
  iep: string | null;
  comments: string | null;
  /** Passed in rather than read from the clock, so output is deterministic. */
  generatedAt: string;
  /** Letterhead mark. PNG/JPG only — pdf-lib cannot embed SVG. */
  logoPng?: ArrayBuffer | null;
};

// Building 21 brand colours, matching the portal.
const TEAL = rgb(0.043, 0.506, 0.588); // #0a8196
const GREY = rgb(0.404, 0.408, 0.416); // #67686a
const LIGHT = rgb(0.6, 0.604, 0.616);

const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 54;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const LABEL_WIDTH = 155;

/** Splits text to fit `maxWidth`, keeping the author's own line breaks. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

const shown = (v: string | null | undefined) =>
  v && String(v).trim() ? String(v) : "—";

export async function renderReleasePdf(data: ReleaseData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const room = (needed: number) => {
    if (y - needed < MARGIN + 30) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  const write = (
    text: string,
    opts: { font?: PDFFont; size?: number; color?: typeof GREY; gap?: number } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    const lineHeight = size * 1.4;
    for (const line of wrap(text, font, size, CONTENT_WIDTH)) {
      room(lineHeight);
      if (line) {
        page.drawText(line, {
          x: MARGIN,
          y: y - size,
          size,
          font,
          color: opts.color ?? GREY,
        });
      }
      y -= lineHeight;
    }
    y -= opts.gap ?? 0;
  };

  const heading = (text: string) => {
    room(30);
    y -= 6;
    page.drawText(text.toUpperCase(), {
      x: MARGIN,
      y: y - 9,
      size: 9,
      font: bold,
      color: TEAL,
    });
    y -= 15;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE.width - MARGIN, y },
      thickness: 0.5,
      color: LIGHT,
    });
    y -= 12;
  };

  const field = (name: string, value: string) => {
    const size = 10.5;
    // Push the value column out when a label runs long, so the two never
    // collide (e.g. "Available for the summer program").
    const valueX =
      MARGIN + Math.max(LABEL_WIDTH, bold.widthOfTextAtSize(name, size) + 12);
    const lines = wrap(value, regular, size, PAGE.width - MARGIN - valueX);
    room(size * 1.4 * lines.length + 4);
    page.drawText(name, { x: MARGIN, y: y - size, size, font: bold, color: GREY });
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: valueX,
        y: y - size - i * size * 1.4,
        size,
        font: regular,
        color: GREY,
      });
    });
    y -= size * 1.4 * Math.max(1, lines.length) + 5;
  };

  // ---- Letterhead -------------------------------------------------------
  // The mark is close to square, so it sits beside the address rather than
  // above the title — keeps the header short on a one-page document.
  let logoDrawn = false;
  if (data.logoPng) {
    try {
      const logo = await pdf.embedPng(data.logoPng);
      const h = 52;
      const w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: MARGIN, y: y - h, width: w, height: h });
      page.drawText("LAUNCHPAD PHILLY", {
        x: MARGIN + w + 14,
        y: y - 24,
        size: 15,
        font: bold,
        color: TEAL,
      });
      page.drawText("801 Market Street, Philadelphia, PA 19107  ·  launchpadphilly.org", {
        x: MARGIN + w + 14,
        y: y - 39,
        size: 8.5,
        font: regular,
        color: LIGHT,
      });
      y -= h + 12;
      logoDrawn = true;
    } catch {
      // Fall through to the text-only letterhead below.
    }
  }
  if (!logoDrawn) {
    page.drawText("LAUNCHPAD PHILLY", {
      x: MARGIN,
      y: y - 17,
      size: 17,
      font: bold,
      color: TEAL,
    });
    y -= 26;
    write("801 Market Street, Philadelphia, PA 19107  ·  launchpadphilly.org", {
      size: 8.5,
      color: LIGHT,
      gap: 10,
    });
  }

  write("Authorization for Release of Student Records", {
    font: bold,
    size: 15,
    gap: 8,
  });
  write(
    "The parent or guardian named below has electronically signed the consent shown on this form " +
      "through the Launchpad Philly application portal. Please release the records described in that " +
      "consent to Launchpad Philly at the address above.",
    { size: 10, gap: 4 },
  );

  // ---- Student ----------------------------------------------------------
  heading("Student");
  field(
    "Legal name",
    `${shown(data.student.firstName)} ${shown(data.student.lastName)}`.replace(" —", ""),
  );
  if (data.student.preferredName) field("Preferred name", data.student.preferredName);
  field("Date of birth", shown(data.student.dateOfBirth));
  field("High school", shown(data.schoolName));

  // ---- Parent / guardian ------------------------------------------------
  heading("Parent or guardian");
  field(
    "Name",
    `${shown(data.parent.firstName)} ${shown(data.parent.lastName)}`.replace(" —", ""),
  );
  field("Relationship to student", shown(data.parent.relationship));
  field("Email", shown(data.parent.email));
  field("Phone", shown(data.parent.phone));

  // ---- Consent ----------------------------------------------------------
  // The snapshot taken at signing, NOT today's setting — so the document stays
  // a true record even after staff edit the live consent copy.
  heading("Consent agreed to at signing");
  write(data.consentText, { size: 10, gap: 6 });

  // ---- Signature --------------------------------------------------------
  heading("Electronic signature");
  if (data.signaturePng) {
    try {
      const png = await pdf.embedPng(data.signaturePng);
      const scale = Math.min(1, 250 / png.width, 70 / png.height);
      const w = png.width * scale;
      const h = png.height * scale;
      room(h + 20);
      page.drawImage(png, { x: MARGIN, y: y - h, width: w, height: h });
      page.drawLine({
        start: { x: MARGIN, y: y - h - 3 },
        end: { x: MARGIN + Math.max(w, 220), y: y - h - 3 },
        thickness: 0.5,
        color: LIGHT,
      });
      y -= h + 14;
    } catch {
      // A bad image must not cost the whole document: the typed legal name
      // below is itself a valid signature under ESIGN/UETA.
      write("[signature image could not be rendered]", {
        font: italic,
        size: 9,
        color: LIGHT,
        gap: 4,
      });
    }
  }
  field("Typed legal name", shown(data.signatureTypedName));
  field("Signed at", formatDateTime(data.signedAt));
  field("Signed from IP", shown(data.signerIp));

  // ---- Other answers ----------------------------------------------------
  const availability = AVAILABILITY_OPTIONS.find((o) => o.value === data.availability)?.label;
  const iep = IEP_OPTIONS.find((o) => o.value === data.iep)?.label;
  heading("Also reported by the parent or guardian");
  field("Available for the summer program", shown(availability));
  if (data.availabilityConcerns) field("Noted conflicts", data.availabilityConcerns);
  field("Student has an IEP", shown(iep));
  if (data.comments) field("Additional comments", data.comments);

  // ---- Footer on every page ---------------------------------------------
  const name = `${shown(data.student.firstName)} ${shown(data.student.lastName)}`.trim();
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(
      `Launchpad Philly · signed record for ${name} · generated ${formatDateTime(data.generatedAt)} · page ${i + 1} of ${pages.length}`,
      { x: MARGIN, y: MARGIN - 26, size: 7.5, font: regular, color: LIGHT },
    );
  });

  return pdf.save();
}

/** Filename for a download, e.g. launchpad-records-release-imparato-nick.pdf */
export function releaseFilename(data: ReleaseData): string {
  const slug = `${data.student.lastName ?? ""}-${data.student.firstName ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `launchpad-records-release-${slug || data.applicationId}.pdf`;
}
