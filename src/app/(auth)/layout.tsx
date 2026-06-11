import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
        {children}
      </main>
    </div>
  );
}
