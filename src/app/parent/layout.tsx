import Image from "next/image";

// DELIBERATELY UNGATED. Parents never create accounts (a PRD non-negotiable),
// so this route tree must NOT copy the auth check in (auth)/layout.tsx or
// (portal)/layout.tsx. Access control is the link token itself, verified in
// loadParentForm() via the service-role client. Adding a session check here
// would lock every parent out of the form.
export default function ParentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-grey-tint4 px-6 py-12">
      {/* The link token lives in the URL path, so don't leak it in a Referer. */}
      <meta name="referrer" content="no-referrer" />
      <Image
        src="/brand/launchpad-logo-main-color.svg"
        alt="Launchpad Philly"
        width={210}
        height={63}
        priority
      />
      <main className="mt-9 w-full max-w-2xl rounded-lg bg-white p-6 shadow-sm">
        {children}
      </main>
    </div>
  );
}
