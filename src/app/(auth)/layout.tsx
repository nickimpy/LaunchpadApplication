import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth-shell";
import { SignedInNotice } from "@/components/signed-in-notice";
import { createClient } from "@/utils/supabase/server";
import { isActiveAdmin } from "@/utils/admin";

/** "nicholas@gmail.com" → "n•••••••@gmail.com": enough to recognise, not to read. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "";
  return `${user[0]}${"•".repeat(Math.max(3, user.length - 1))}@${domain}`;
}

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Someone is already signed in. Don't forward them into the portal — on a
  // shared computer that hands the next student the previous student's
  // application. Say who's signed in and offer both doors instead.
  if (user) {
    const staff = await isActiveAdmin(user.id);
    const { data: student } = await supabase
      .from("students")
      .select("first_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle();
    const meta = user.user_metadata ?? {};
    const name =
      student?.preferred_name ||
      student?.first_name ||
      (typeof meta.first_name === "string" && meta.first_name) ||
      "someone else";
    return (
      <AuthShell>
        <SignedInNotice
          name={name}
          maskedEmail={user.email ? maskEmail(user.email) : ""}
          home={staff ? "/admin" : "/portal"}
        />
      </AuthShell>
    );
  }

  return <AuthShell>{children}</AuthShell>;
}
