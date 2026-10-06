import { AuthShell } from "@/components/auth-shell";

// Deliberately NOT inside (auth): that group's layout sends every logged-in
// user to the portal, but a password-reset link logs you in (that is how the
// recovery link proves who you are) BEFORE you've chosen a new password. Under
// (auth), the reset form was unreachable — people were bounced straight into
// the portal without ever setting one. Do not add a logged-in redirect here.
export default function RecoveryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AuthShell>{children}</AuthShell>;
}
