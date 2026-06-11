import type { Metadata } from "next";
import Link from "next/link";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Verify your email — Launchpad" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Check your email</h1>
      <p className="mb-6">
        We sent a verification link
        {email ? (
          <>
            {" "}
            to <span className="font-bold">{email}</span>
          </>
        ) : null}
        . Click it to confirm your account, then come back and log in. You
        can&apos;t enter the portal until your email is verified.
      </p>
      <p className="mb-6 text-base">
        Didn&apos;t get it? Check your spam folder, or resend it below.
      </p>
      {email ? (
        <ResendForm email={email} />
      ) : (
        <p>
          <Link href="/login" className="font-bold text-teal-dark underline">
            Back to log in
          </Link>
        </p>
      )}
      <p className="mt-6 text-base">
        <Link href="/login" className="font-bold text-teal-dark underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
