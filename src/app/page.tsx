import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Image
        src="/brand/launchpad-logo-main-color.svg"
        alt="Launchpad Philly"
        width={280}
        height={84}
        priority
      />
      <h1 className="text-xl font-bold text-teal-dark">
        Launchpad Application Portal
      </h1>
      <p className="max-w-md text-center text-base">
        Start your application to Launchpad Philly, or log in to pick up where
        you left off.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/signup"
          className="w-full rounded-md bg-teal-dark px-3 py-3 text-center text-base font-bold
            text-white hover:brightness-110 focus:outline-none focus-visible:ring-2
            focus-visible:ring-teal-dark focus-visible:ring-offset-2"
        >
          Create an account
        </Link>
        <Link
          href="/login"
          className="w-full rounded-md border border-grey-tint1 px-3 py-3 text-center text-base
            font-bold text-grey hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
            focus-visible:ring-teal-dark"
        >
          Log in
        </Link>
      </div>
      <p className="max-w-md text-center text-xs">
        Questions? Reach out to{" "}
        <a className="text-teal-dark underline" href="mailto:info@launchpadphilly.org">
          info@launchpadphilly.org
        </a>
        .
      </p>
    </main>
  );
}
