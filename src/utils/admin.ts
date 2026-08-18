import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  isSuperAdmin: boolean;
};

/**
 * The signed-in staff member, or null for anyone who isn't an ACTIVE admin.
 * Deactivated admins read as null here and are also rejected by RLS
 * (`is_admin()` requires `is_active`), so revoking access is a single flag.
 *
 * React-cached per request: the layout and the pages beneath it all call this.
 */
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: admin } = await supabase
    .from("admin_users")
    .select("id, email, first_name, last_name, is_super_admin, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!admin) return null;

  const firstName = (admin.first_name as string | null) ?? "";
  const lastName = (admin.last_name as string | null) ?? "";
  return {
    id: admin.id as string,
    email: admin.email as string,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" ") || (admin.email as string),
    isSuperAdmin: Boolean(admin.is_super_admin),
  };
});

/**
 * Does this user also have a student application? Staff emails are shared with
 * students at Launchpad (it's why the PRD rules out domain SSO), so the same
 * person can legitimately hold both roles — the portal and the dashboard link
 * to each other rather than one locking the other out.
 */
export const hasStudentRecord = cache(async (userId: string): Promise<boolean> => {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data);
});

/** True when this auth user is an active admin — used for post-login routing. */
export async function isActiveAdmin(userId: string): Promise<boolean> {
  // Service role: this runs in contexts (right after sign-in) where the
  // request's own session may not be readable yet.
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select("id")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Writes an entry to the audit log. The PRD requires a trail for admin edits
 * to student info, interview/status updates, and decisions.
 *
 * Deliberately never throws: an audit write failing must not roll back or
 * block the edit the staff member actually made. Failures are logged instead.
 */
export async function logAdminAction(params: {
  actor: AdminUser;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("audit_log").insert({
    actor_id: params.actor.id,
    actor_email: params.actor.email,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
  });
  if (error) console.error("audit_log write failed:", error.message, params.action);
}
