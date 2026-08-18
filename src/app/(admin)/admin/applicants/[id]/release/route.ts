import { NextResponse } from "next/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { buildReleasePdf } from "@/utils/release-pdf";

/**
 * The signed records-release form as a PDF, for sending to a student's high
 * school to request their transcript.
 *
 * Re-checks admin access itself — route handlers don't run inside layouts, and
 * this response contains a minor's identifiers plus their guardian's signature.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return new NextResponse("Not found", { status: 404 });

  const { id } = await params;
  const result = await buildReleasePdf(id);
  if (!result) {
    return new NextResponse(
      "No signed parent form for this applicant yet.",
      { status: 404 },
    );
  }

  // Worth an audit entry: this is the point a signed consent document leaves
  // the system, and staff may need to show who sent what to which school.
  await logAdminAction({
    actor: admin,
    action: "records_release.download",
    entityType: "application",
    entityId: id,
  });

  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
