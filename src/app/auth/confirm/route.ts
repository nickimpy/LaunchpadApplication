import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// One endpoint for every Supabase email link: signup confirmation, magic
// link, and password recovery. The email templates point here with
// ?token_hash=...&type=...&next=... (see the dashboard setup in CLAUDE.md).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // recovery links should land on the set-new-password page
  const next = searchParams.get("next") ?? "/portal";

  if (token_hash && type) {
    const supabase = createClient(await cookies());
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // An email-change confirmation updates auth.users.email; mirror it onto
      // the students row so the profile and notifications stay in sync.
      if (type === "email_change" && data.user?.email) {
        await supabase
          .from("students")
          .update({ email: data.user.email.toLowerCase() })
          .eq("id", data.user.id);
      }
      const dest = type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-error", request.url));
}
