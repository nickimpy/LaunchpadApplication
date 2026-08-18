import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AuthErrorDetail } from "./error-detail";

export const metadata: Metadata = { title: "Link problem — Launchpad" };

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-grey-tint4 px-6 py-12">
      <Link href="/" aria-label="Launchpad Philly home">
        <Image
          src="/brand/launchpad-logo-main-color.svg"
          alt="Launchpad Philly"
          width={210}
          height={63}
          priority
        />
      </Link>
      <main className="mt-9 w-full max-w-md rounded-lg bg-white p-6 shadow-sm">
        <AuthErrorDetail />
        <ul className="flex flex-col gap-3">
          <li>
            <Link
              href="/login"
              className="font-bold text-teal-dark underline"
            >
              Log in
            </Link>
          </li>
          <li>
            <Link
              href="/verify-email"
              className="font-bold text-teal-dark underline"
            >
              Resend the verification email
            </Link>
          </li>
          <li>
            <Link
              href="/forgot-password"
              className="font-bold text-teal-dark underline"
            >
              Resend a password reset link
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}
