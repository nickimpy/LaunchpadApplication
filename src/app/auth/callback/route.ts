import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Landing point for Supabase's DEFAULT email links. Those links hit
// Supabase's /auth/v1/verify endpoint, which confirms the token server-side
// and redirects here with ?code= (PKCE). We exchange it for a session.
//
// (When custom SMTP + branded templates land in Phase 9, the token_hash
// flow via /auth/confirm can replace this and also work cross-device.)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portal";

  if (code) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Keep students.email in sync after an email-change confirmation.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        await supabase
          .from("students")
          .update({ email: user.email.toLowerCase() })
          .eq("id", user.id);
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-error", origin));
}
