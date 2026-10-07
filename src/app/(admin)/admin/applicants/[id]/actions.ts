"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { dbErrorMessage, type DbError } from "@/utils/db-errors";
import {
  field,
  emailError,
  phoneError,
  nameError,
  requiredError,
} from "@/utils/validation";

export type AdminFormState = { error?: string; success?: string };

const DENIED = "You don't have permission to do that.";

/** Staff see why a write failed (permissions, missing migration, bad value). */
const failed = (error: DbError, what: string) =>
  dbErrorMessage(error, { audience: "staff", action: what });

/**
 * Staff edit of a student's contact details. Audit-logged with before/after —
 * the PRD requires a trail for any admin edit to student information.
 */
export async function updateStudentInfo(
  applicationId: string,
  studentId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const values = {
    first_name: field(formData, "first_name"),
    last_name: field(formData, "last_name"),
    preferred_name: field(formData, "preferred_name"),
    phone: field(formData, "phone"),
  };

  const problem =
    nameError(values.first_name, "first name") ??
    nameError(values.last_name, "last name") ??
    phoneError(values.phone);
  if (problem) return { error: problem };

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("students")
    .select("first_name, last_name, preferred_name, phone")
    .eq("id", studentId)
    .maybeSingle();

  const { error } = await supabase
    .from("students")
    .update({ ...values, preferred_name: values.preferred_name || null })
    .eq("id", studentId);
  if (error) return { error: failed(error, "save the student's details") };

  await logAdminAction({
    actor: admin,
    action: "student.update",
    entityType: "application",
    entityId: applicationId,
    before,
    after: values,
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return { success: "Student details updated." };
}

/** Staff edit of guardian contact info — the PRD's wrong-email recovery path. */
export async function updateGuardian(
  applicationId: string,
  guardianId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const values = {
    first_name: field(formData, "first_name"),
    last_name: field(formData, "last_name"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    relationship: field(formData, "relationship"),
  };

  const problem =
    nameError(values.first_name, "guardian's first name") ??
    nameError(values.last_name, "guardian's last name") ??
    emailError(values.email) ??
    phoneError(values.phone) ??
    requiredError(values.relationship, "relationship to the student");
  if (problem) return { error: problem };

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("guardians")
    .select("first_name, last_name, email, phone, relationship")
    .eq("id", guardianId)
    .maybeSingle();

  const { error } = await supabase
    .from("guardians")
    .update(values)
    .eq("id", guardianId);
  if (error) return { error: failed(error, "save the guardian contact") };

  await logAdminAction({
    actor: admin,
    action: "guardian.update",
    entityType: "application",
    entityId: applicationId,
    before,
    after: values,
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return {
    success:
      "Guardian details updated. If the email changed, send them the parent link again.",
  };
}

/**
 * Issues a fresh parent link. The token is the parent form's only credential,
 * so rotating it immediately invalidates the old URL — used when a link was
 * sent to the wrong address.
 */
export async function regenerateParentLinkAsAdmin(
  applicationId: string,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("applications")
    .update({
      parent_link_token: randomUUID(),
      parent_link_generated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
  if (error) return { error: failed(error, "create a new parent link") };

  await logAdminAction({
    actor: admin,
    action: "parent_link.regenerate",
    entityType: "application",
    entityId: applicationId,
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  return { success: "New parent link generated — the old link no longer works." };
}

/** Free-text staff note on an applicant. */
export async function addNote(
  applicationId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const body = field(formData, "body");
  if (!body) return { error: "Write the note first." };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("admin_notes")
    .insert({ application_id: applicationId, author_id: admin.id, body });
  if (error) return { error: failed(error, "add the note") };

  revalidatePath(`/admin/applicants/${applicationId}`);
  return { success: "Note added." };
}

/**
 * Clears the college-plan flag after staff have talked it through with the
 * student (e.g. "going to CCP part-time", "college only after 101"). A note is
 * required so the reason survives — the flag itself is the student's answer
 * and stays recorded; this only marks it as dealt with. Audit-logged.
 */
export async function resolveCollegeFlag(
  applicationId: string,
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const note = field(formData, "resolution");
  if (!note) {
    return { error: "Say what you learned, e.g. \"Attending CCP part-time — fits the schedule.\"" };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("applications")
    .update({
      college_warning_resolved_at: new Date().toISOString(),
      college_warning_resolved_by: admin.id,
      college_warning_resolution: note,
    })
    .eq("id", applicationId);
  if (error) return { error: failed(error, "resolve the college flag") };

  await logAdminAction({
    actor: admin,
    action: "college_flag.resolve",
    entityType: "application",
    entityId: applicationId,
    after: { resolution: note },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  revalidatePath("/admin/applicants");
  return { success: "Flag resolved." };
}

/** Puts a resolved college flag back up, e.g. if the student's plans change. */
export async function reopenCollegeFlag(
  applicationId: string,
  _prev: AdminFormState,
): Promise<AdminFormState> {
  const admin = await getAdminUser();
  if (!admin) return { error: DENIED };

  const supabase = createClient(await cookies());
  const { data: before } = await supabase
    .from("applications")
    .select("college_warning_resolution")
    .eq("id", applicationId)
    .maybeSingle();

  const { error } = await supabase
    .from("applications")
    .update({
      college_warning_resolved_at: null,
      college_warning_resolved_by: null,
      college_warning_resolution: null,
    })
    .eq("id", applicationId);
  if (error) return { error: failed(error, "reopen the college flag") };

  await logAdminAction({
    actor: admin,
    action: "college_flag.reopen",
    entityType: "application",
    entityId: applicationId,
    before: { resolution: before?.college_warning_resolution ?? null },
  });

  revalidatePath(`/admin/applicants/${applicationId}`);
  revalidatePath("/admin/applicants");
  return { success: "Flag reopened." };
}
