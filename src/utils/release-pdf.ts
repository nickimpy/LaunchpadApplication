import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  renderReleasePdf,
  releaseFilename,
  type ReleaseData,
} from "@/utils/release-pdf-render";

/**
 * Fetches everything the records-release document needs and renders it.
 * Reads through the admin's own session, so RLS is still the gatekeeper.
 *
 * Returns null when this applicant has no submitted parent form yet.
 */
export async function buildReleasePdf(
  applicationId: string,
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const supabase = createClient(await cookies());

  const [{ data: application }, { data: form }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        `id, school_other,
         students ( first_name, last_name, preferred_name, date_of_birth ),
         schools ( name )`,
      )
      .eq("id", applicationId)
      .maybeSingle(),
    supabase
      .from("parent_form_submissions")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle(),
  ]);
  if (!application || !form) return null;

  // Cast through `unknown`: PostgREST types a to-one join as an array, though
  // at runtime it is a single object (same pattern as applicant-profile.ts).
  const student = application.students as unknown as {
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    date_of_birth: string | null;
  } | null;
  const school = application.schools as unknown as { name: string | null } | null;

  let signaturePng: ArrayBuffer | null = null;
  const path = form.signature_image_path as string | null;
  if (path) {
    const { data: file } = await supabase.storage.from("signatures").download(path);
    if (file) signaturePng = await file.arrayBuffer();
  }

  const data: ReleaseData = {
    applicationId,
    student: {
      firstName: student?.first_name ?? null,
      lastName: student?.last_name ?? null,
      preferredName: student?.preferred_name ?? null,
      dateOfBirth: student?.date_of_birth ?? null,
    },
    schoolName: school?.name ?? (application.school_other as string) ?? "",
    parent: {
      firstName: form.parent_first_name as string,
      lastName: form.parent_last_name as string,
      relationship: form.parent_relationship as string,
      email: form.parent_email as string,
      phone: form.parent_phone as string,
    },
    consentText: String(form.consent_text_snapshot ?? ""),
    signaturePng,
    signatureTypedName: form.signature_typed_name as string,
    signedAt: String(form.signed_at),
    signerIp: (form.signer_ip as string | null) ?? null,
    availability: (form.availability as string | null) ?? null,
    availabilityConcerns: (form.availability_concerns as string | null) ?? null,
    iep: (form.iep as string | null) ?? null,
    comments: (form.comments as string | null) ?? null,
    generatedAt: new Date().toISOString(),
  };

  return { bytes: await renderReleasePdf(data), filename: releaseFilename(data) };
}
