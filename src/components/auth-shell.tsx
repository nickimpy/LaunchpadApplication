import Image from "next/image";
import Link from "next/link";
import { BannerStrip } from "@/components/portal/portal-hero";

/** The logo + white card every logged-out page (login, signup, reset) sits in. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-grey-tint4">
      <BannerStrip />
      <div className="flex flex-1 flex-col items-center px-6 py-12">
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
    </div>
  );
}
