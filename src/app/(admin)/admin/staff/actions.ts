"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAdminUser, logAdminAction } from "@/utils/admin";
import { getOrigin } from "@/utils/origin";
import { field, emailError } from "@/utils/validation";

export type StaffState = {
  error?: string;
  success?: string;
  /** Shown once, for the super admin to pass on. Never stored or emailed. */
  inviteLink?: string;
};

const DENIED = "Only the super admin can manage staff accounts.";

/**
 * Invites a staff member. Admin accounts are invite-only (PRD) — there is no
 * admin signup page.
 *
 * Transactional email doesn't exist until Phase 9, so this doesn't send
 * anything: it creates the auth user and returns a one-time set-password link
 * for the super admin to pass along over a channel they trust. Once Resend is
 * wired up, this same link can simply be emailed instead.
 */
export async function inviteAdmin(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const actor = await getAdminUser();
  if (!actor?.isSuperAdmin) return { error: DENIED };

  const email = field(formData, "email").toLowerCase();
  const firstName = field(formData, "first_name");
  const lastName = field(formData, "last_name");
  if (emailError(email)) return { error: "Enter a valid email address." };

  const admin = createAdminClient();

  // Re-use the auth user if one already exists — staff emails here are often
  // already student accounts, which is expected and supported.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId = list?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id;

  if (!userId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true, // staff are vouched for by the super admin
    });
    if (createErr || !created.user) {
      return { error: createErr?.message ?? "Couldn't create that account." };
    }
    userId = created.user.id;
  }

  const { error: rowErr } = await admin.from("admin_users").upsert(
    {
      id: userId,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      is_active: true,
      invited_by: actor.id,
    },
    { onConflict: "id" },
  );
  if (rowErr) return { error: "Couldn't save that staff member." };

  // A recovery link doubles as "set your password for the first time".
  const origin = await getOrigin();
  const { data: link } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/reset-password` },
  });

  await logAdminAction({
    actor,
    action: "admin.invite",
    entityType: "admin_user",
    entityId: userId,
    after: { email },
  });

  revalidatePath("/admin/staff");
  return {
    success: `${email} can now sign in as staff.`,
    inviteLink: link?.properties?.action_link,
  };
}

/** Deactivating is the off switch: is_admin() requires is_active, so RLS
 *  refuses a deactivated admin at the database, not just in the UI. */
export async function setAdminActive(
  adminId: string,
  active: boolean,
): Promise<StaffState> {
  const actor = await getAdminUser();
  if (!actor?.isSuperAdmin) return { error: DENIED };
  if (adminId === actor.id) {
    return { error: "You can't deactivate your own account." };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("admin_users")
    .update({ is_active: active })
    .eq("id", adminId);
  if (error) return { error: "That didn't save. Please try again." };

  await logAdminAction({
    actor,
    action: active ? "admin.reactivate" : "admin.deactivate",
    entityType: "admin_user",
    entityId: adminId,
  });

  revalidatePath("/admin/staff");
  return { success: active ? "Access restored." : "Access revoked." };
}
