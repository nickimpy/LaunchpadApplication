import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Alert } from "@/components/forms";

export const metadata: Metadata = { title: "Log in — Launchpad" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { confirmed } = await searchParams;
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Log in</h1>
      {/* /auth/callback sends people here when their email link was valid but
          this browser couldn't finish signing them in (see that route). */}
      {confirmed && (
        <Alert tone="success">
          <p className="mb-1 font-bold">Your email is confirmed.</p>
          <p>
            Log in below to open your application. If logging in says your
            email isn&apos;t confirmed yet, we can{" "}
            <Link href="/verify-email" className="font-bold text-teal-dark underline">
              send you a fresh link
            </Link>
            .
          </p>
        </Alert>
      )}
      <p className="mb-6">
        New here?{" "}
        <Link href="/signup" className="font-bold text-teal-dark underline">
          Create an account
        </Link>
      </p>
      <LoginForm />
    </>
  );
}
