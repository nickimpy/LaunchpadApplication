import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser, hasStudentRecord } from "@/utils/admin";
import { logout } from "@/app/(portal)/profile/actions";

// Auth gate lives HERE (server layout), matching (auth)/ and (portal)/.
// src/proxy.ts only refreshes the session cookie — never gate routes there.
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdminUser();
  // Anyone who isn't an active admin is bounced to the student login. We
  // deliberately don't say "you're not an admin" — that would confirm the
  // dashboard exists to anyone who guesses the URL.
  if (!admin) redirect("/login");

  const alsoStudent = await hasStudentRecord(admin.id);

  return (
    <div className="flex min-h-screen flex-col bg-grey-tint4">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3
          focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-3
          focus:text-base focus:font-bold focus:text-teal-dark"
      >
        Skip to content
      </a>

      <header className="border-b border-grey-tint2 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" aria-label="Launchpad admin home">
              <Image
                src="/brand/launchpad-logo-main-color.svg"
                alt="Launchpad Philly"
                width={140}
                height={42}
                priority
              />
            </Link>
            <nav aria-label="Admin sections" className="flex flex-wrap gap-6">
              <Link className="font-bold text-teal-dark hover:underline" href="/admin">
                Dashboard
              </Link>
              <Link
                className="font-bold text-teal-dark hover:underline"
                href="/admin/applicants"
              >
                Applicants
              </Link>
              {admin.isSuperAdmin && (
                <Link
                  className="font-bold text-teal-dark hover:underline"
                  href="/admin/staff"
                >
                  Staff
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs">
              {admin.displayName}
              {admin.isSuperAdmin && (
                <span className="ml-1 rounded-full bg-teal-tint3 px-3 py-1 text-xs font-bold text-teal-dark">
                  Super admin
                </span>
              )}
            </span>
            {/* Staff emails are shared with students here, so one person can
                hold both roles — link across rather than locking either out. */}
            {alsoStudent && (
              <Link className="text-xs text-teal-dark underline" href="/portal">
                My application
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs
                  font-bold text-teal-dark hover:bg-grey-tint4 focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-teal-dark"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="admin-content" className="mx-auto w-full max-w-7xl flex-1 px-6 py-9">
        {children}
      </main>
    </div>
  );
}
