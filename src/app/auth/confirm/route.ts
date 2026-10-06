import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// One endpoint for every Supabase email link: signup confirmation, magic
// link, and password recovery. The email templates point here with
// ?token_hash=...&type=...&next=... (see "Email templates" in CLAUDE.md).
//
// GET deliberately does NOT verify anything. Mail providers (Gmail especially)
// and corporate scanners open every link in an email to check it, and a
// verification token is one-time — so verifying on GET lets the scanner spend
// it before the applicant ever clicks, and their own click then fails with
// "this link didn't work". Scanners follow links but never press buttons, so
// GET only shows a confirm page and POST (the button) does the verification.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL("/auth/auth-error", request.url));
  }

  const page = new URL("/auth/confirm-link", request.url);
  page.searchParams.set("token_hash", token_hash);
  page.searchParams.set("type", type);
  const next = searchParams.get("next");
  if (next) page.searchParams.set("next", next);
  return NextResponse.redirect(page);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token_hash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  // Only ever a same-site path: this value rides through an email link.
  const rawNext = String(form.get("next") ?? "");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/portal";

  // 303 so the browser follows the redirect with GET, not another POST.
  const go = (path: string) =>
    NextResponse.redirect(new URL(path, request.url), 303);

  if (!token_hash || !type) return go("/auth/auth-error");

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return go("/auth/auth-error");

  // An email-change confirmation updates auth.users.email; mirror it onto the
  // students row so the profile and notifications stay in sync.
  if (type === "email_change" && data.user?.email) {
    await supabase
      .from("students")
      .update({ email: data.user.email.toLowerCase() })
      .eq("id", data.user.id);
  }

  // recovery links should land on the set-new-password page
  return go(type === "recovery" ? "/reset-password" : next);
}
