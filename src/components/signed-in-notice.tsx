"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAndReturn } from "@/app/(auth)/signout-actions";
import { SubmitButton } from "@/components/forms";

/**
 * Shown on the login/signup pages when someone is ALREADY signed in, instead
 * of silently forwarding them to the portal. On a shared computer (school
 * labs) that forward used to drop the next student straight into the
 * previous student's application. The email is partly masked so a passer-by
 * can recognise "that's not me" without reading someone else's address.
 */
export function SignedInNotice({
  name,
  maskedEmail,
  home,
}: {
  name: string;
  maskedEmail: string;
  home: "/portal" | "/admin";
}) {
  const pathname = usePathname();
  return (
    <>
      <h1 className="mb-3 text-xl font-bold">You&apos;re already signed in</h1>
      <p className="mb-6">
        This browser is signed in as <span className="font-bold">{name}</span>
        {maskedEmail && <> ({maskedEmail})</>}.
      </p>
      <Link
        href={home}
        className="mb-3 block w-full rounded-md bg-teal-dark px-3 py-3 text-center text-base
          font-bold text-white hover:brightness-110 focus:outline-none focus-visible:ring-2
          focus-visible:ring-teal-dark focus-visible:ring-offset-2"
      >
        {home === "/admin" ? "Continue to the dashboard" : "Continue to my application"}
      </Link>
      <form action={signOutAndReturn}>
        <input type="hidden" name="next" value={pathname} />
        <p className="mb-3 mt-6 text-xs">
          Not you, or setting up a different account? Log out first — this
          keeps everyone&apos;s application private on a shared computer.
        </p>
        <SubmitButton pendingLabel="Logging out…">Not you? Log out</SubmitButton>
      </form>
    </>
  );
}
