import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirm — Launchpad",
  robots: { index: false, follow: false },
};

// Never cache: the token in the URL is personal and single-use.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const COPY: Record<string, { heading: string; body: string; button: string }> = {
  signup: {
    heading: "Confirm your email",
    body: "One last step — press the button to confirm your email address and open your application.",
    button: "Confirm my email",
  },
  email: {
    heading: "Confirm your email",
    body: "One last step — press the button to confirm your email address and open your application.",
    button: "Confirm my email",
  },
  magiclink: {
    heading: "Log in to Launchpad",
    body: "Press the button to log in. You won't need a password.",
    button: "Log me in",
  },
  recovery: {
    heading: "Reset your password",
    body: "Press the button to choose a new password.",
    button: "Continue",
  },
  email_change: {
    heading: "Confirm your new email",
    body: "Press the button to confirm the new email address on your account.",
    button: "Confirm new email",
  },
};

/**
 * The page a Supabase email link lands on. It only shows a button — the actual
 * verification happens when that button posts to /auth/confirm, so mail
 * scanners that merely open the link can't use up the one-time token.
 * A plain HTML form post: it works without JavaScript and is fully keyboard
 * and screen-reader accessible.
 */
export default async function ConfirmLinkPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const tokenHash = one("token_hash");
  const type = one("type");
  const next = one("next");
  const copy = COPY[type] ?? COPY.signup;

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
        {tokenHash ? (
          <>
            <h1 className="mb-3 text-xl font-bold">{copy.heading}</h1>
            <p className="mb-6">{copy.body}</p>
            <form method="post" action="/auth/confirm">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type || "signup"} />
              {next && <input type="hidden" name="next" value={next} />}
              <button
                type="submit"
                className="w-full rounded-md bg-teal-dark px-3 py-3 text-base font-bold text-white
                  hover:brightness-110 focus:outline-none focus-visible:ring-2
                  focus-visible:ring-teal-dark focus-visible:ring-offset-2"
              >
                {copy.button}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-xl font-bold">This link is incomplete</h1>
            <p className="mb-6">
              Try the link in your email again, or{" "}
              <Link href="/login" className="font-bold text-teal-dark underline">
                log in
              </Link>{" "}
              if you already have an account.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
