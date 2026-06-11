import Image from "next/image";

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
        Applications aren&apos;t open quite yet. Check back soon, or reach out
        to{" "}
        <a
          className="text-teal underline"
          href="mailto:info@launchpadphilly.org"
        >
          info@launchpadphilly.org
        </a>{" "}
        with questions.
      </p>
    </main>
  );
}
