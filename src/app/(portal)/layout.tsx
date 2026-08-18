import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getPortalData } from "@/utils/step-engine";
import { isActiveAdmin, hasStudentRecord } from "@/utils/admin";
import { StepNav } from "@/components/portal/step-nav";
import { logout } from "./profile/actions";

// Auth gate lives HERE (server layout), not in src/proxy.ts — same pattern
// as (auth)/layout.tsx. The proxy only refreshes the session cookie.
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Staff who have no application of their own belong in the dashboard, not
  // here. Checked BEFORE getPortalData so its self-heal never fabricates a
  // student record for a staff account.
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if ((await isActiveAdmin(user.id)) && !(await hasStudentRecord(user.id))) {
    redirect("/admin");
  }

  const data = await getPortalData();
  if (!data) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-grey-tint4">
      <a
        href="#portal-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3
          focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-3
          focus:text-base focus:font-bold focus:text-teal-dark"
      >
        Skip to content
      </a>
      <header className="flex items-center justify-between gap-3 border-b border-grey-tint2 bg-white px-6 py-3">
        <Link href="/portal" aria-label="Your application home">
          <Image
            src="/brand/launchpad-logo-main-color.svg"
            alt="Launchpad Philly"
            width={160}
            height={48}
            priority
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="rounded-md px-3 py-3 text-base font-bold text-teal-dark
              hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
              focus-visible:ring-teal-dark"
          >
            Profile
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-grey-tint1 px-3 py-3 text-base font-bold
                text-grey hover:bg-grey-tint4 focus:outline-none focus-visible:ring-2
                focus-visible:ring-teal-dark"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <StepNav steps={data.steps} completedCount={data.completedCount} />
        <main id="portal-content" className="min-w-0 flex-1 px-6 py-9">
          <div className="mx-auto w-full max-w-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
