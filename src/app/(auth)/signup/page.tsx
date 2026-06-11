import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account — Launchpad" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Create your account</h1>
      <p className="mb-6">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-teal-dark underline">
          Log in
        </Link>
      </p>
      <SignupForm />
    </>
  );
}
