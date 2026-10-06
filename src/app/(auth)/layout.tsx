import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { createClient } from "@/utils/supabase/server";
import { isActiveAdmin } from "@/utils/admin";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-in users don't need the auth pages. Staff go to the dashboard;
  // everyone else to the student portal.
  if (user) redirect((await isActiveAdmin(user.id)) ? "/admin" : "/portal");

  return <AuthShell>{children}</AuthShell>;
}
