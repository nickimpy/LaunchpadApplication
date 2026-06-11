import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password — Launchpad" };

export default async function ResetPasswordPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <h1 className="mb-3 text-xl font-bold">Link expired</h1>
        <p className="mb-6">
          This password reset link is invalid or has expired. Request a new one
          from the login page.
        </p>
        <p>
          <Link
            href="/forgot-password"
            className="font-bold text-teal-dark underline"
          >
            Request a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Set a new password</h1>
      <p className="mb-6">Choose a new password for your account.</p>
      <ResetPasswordForm />
    </>
  );
}
