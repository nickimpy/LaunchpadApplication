import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password — Launchpad" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Reset your password</h1>
      <p className="mb-6">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-base">
        <Link href="/login" className="font-bold text-teal-dark underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
