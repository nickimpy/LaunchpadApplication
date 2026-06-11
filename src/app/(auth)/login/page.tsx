import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in — Launchpad" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">Log in</h1>
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
