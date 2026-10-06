import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Landing point for Supabase's DEFAULT email links. Those links hit
// Supabase's /auth/v1/verify endpoint, which confirms the token server-side
// and redirects here with ?code= (PKCE). We exchange it for a session.
//
// (Once the email templates point at /auth/confirm — see CLAUDE.md — that flow
// replaces this one and also works cross-device.)
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

    // Supabase only redirects here with a `code` AFTER it has already verified
    // the link, so a failed exchange almost always means the verification worked
    // but this browser can't finish signing in (the PKCE verifier cookie lives
    // in the browser that started signup — Gmail's in-app browser, or a phone
    // when signup happened on a laptop). The account IS confirmed, so send them
    // to log in rather than to a "this link didn't work" dead end.
    return NextResponse.redirect(new URL("/login?confirmed=1", origin));
  }

  return NextResponse.redirect(new URL("/auth/auth-error", origin));
}
