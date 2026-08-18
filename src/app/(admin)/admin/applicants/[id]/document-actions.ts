"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { field } from "@/utils/validation";
import type { AdminFormState } from "./actions";

const DENIED = "You don't have permission to do that.";

/** Matches the documents.doc_type check constraint. */
export const DOC_TYPES = [
  { value: "transcript", label: "Transcript" },
  { value: "attendance", label: "Attendance record" },
  { value: "iep_504", label: "IEP / 504 plan" },
  { value: "other", label: "Other" },
] as const;

// ~200 transcripts a cycle (PRD), so generous per-file but not unbounded.
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Uploads a student record (transcript, attendance, IEP/504) to the private
 * `documents` bucket. Storage RLS already restricts that bucket to admins, so
 * this runs on the staff member's own session rather than the service role.
 */
export async function uploadDocument(
  applicationId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const docType = field(formData, "doc_type");
  if (!DOC_TYPES.some((d) => d.value === docType)) {
    return { error: "Choose what kind of document this is." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is larger than 15 MB. Please upload a smaller copy." };
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return { error: "Upload a PDF, Word document, or image." };
  }

  // Random prefix keeps same-named files (every "transcript.pdf") apart, and
  // the applicant folder makes a student's records easy to find later.
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const path = `${applicationId}/${docType}/${randomUUID()}-${safeName}`;

  const supabase = createClient(await cookies());
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadErr) return { error: "The upload failed. Please try again." };

  const { error: rowErr } = await supabase.from("documents").insert({
    application_id: applicationId,
    doc_type: docType,
    storage_path: path,
    file_name: file.name,
    uploaded_by: admin.id,
  });
  if (rowErr) {
    // Don't leave an orphaned object behind if the row didn't land.
    await supabase.storage.from("documents").remove([path]);
    return { error: "The upload failed. Please try again." };
  }

  await logAdminAction({
    actor: admin,
    action: "document.upload",
    entityType: "application",
    entityId: applicationId,
    after: { doc_type: docType, file_name: file.name },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return { success: `Uploaded ${file.name}.` };
}

/** Removes a document record and its stored file. */
export async function deleteDocument(
  applicationId: string,
  documentId: string,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const supabase = createClient(await cookies());
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "That document is already gone." };

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { error: "Couldn't remove that document." };
  await supabase.storage.from("documents").remove([doc.storage_path as string]);

  await logAdminAction({
    actor: admin,
    action: "document.delete",
    entityType: "application",
    entityId: applicationId,
    before: { file_name: doc.file_name },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return { success: "Document removed." };
}
