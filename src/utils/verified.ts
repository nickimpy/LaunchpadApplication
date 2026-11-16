import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Login accounts whose email is confirmed, mapped to when they last signed in.
 * auth.users isn't readable through the API, so this uses the service role —
 * staff-only server code only. ~hundreds of users per cycle; paginated anyway.
 */
export async function getAuthStatus(): Promise<
  Map<string, { verified: boolean; createdAt: string; lastSignIn: string | null }>
> {
  const admin = createAdminClient();
  const out = new Map<string, { verified: boolean; createdAt: string; lastSignIn: string | null }>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      out.set(u.id, {
        verified: Boolean(u.email_confirmed_at),
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}
