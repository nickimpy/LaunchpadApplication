import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getAdminUser } from "@/utils/admin";
import { InviteAdminForm, ToggleAdminButton } from "@/components/admin/staff-forms";

export const metadata: Metadata = { title: "Staff — Launchpad Admin" };

export default async function StaffPage() {
  const actor = await getAdminUser();
  // Managing staff is super-admin only; ordinary admins get the dashboard.
  if (!actor?.isSuperAdmin) redirect("/admin");

  const supabase = createClient(await cookies());
  const { data: staff } = await supabase
    .from("admin_users")
    .select("id, email, first_name, last_name, is_super_admin, is_active, created_at")
    .order("created_at");

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Staff access</h1>
      <p className="mb-9">
        Admin accounts are invite-only — there&apos;s no staff signup page.
        Everyone here has the same access except you, the super admin, who can
        add and remove people.
      </p>

      <section className="mb-6 rounded-lg border border-grey-tint2 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-bold">Add a staff member</h2>
        <InviteAdminForm />
      </section>

      <section className="overflow-x-auto rounded-lg border border-grey-tint2 bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-base">
          <caption className="sr-only">Staff accounts</caption>
          <thead>
            <tr className="border-b border-grey-tint2 text-left">
              <th scope="col" className="px-3 py-3">Name</th>
              <th scope="col" className="px-3 py-3">Email</th>
              <th scope="col" className="px-3 py-3">Role</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((a) => {
              const name =
                [a.first_name, a.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={a.id} className="border-b border-grey-tint3 last:border-0">
                  <th scope="row" className="px-3 py-3 text-left font-normal">
                    {name}
                    {a.id === actor.id && (
                      <span className="ml-3 text-xs text-grey-tint1">(you)</span>
                    )}
                  </th>
                  <td className="px-3 py-3">{a.email}</td>
                  <td className="px-3 py-3">
                    {a.is_super_admin ? "Super admin" : "Admin"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        a.is_active
                          ? "bg-green-tint3 text-green-dark"
                          : "bg-grey-tint3 text-grey"
                      }`}
                    >
                      {a.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {a.id !== actor.id && (
                      <ToggleAdminButton
                        adminId={a.id}
                        active={Boolean(a.is_active)}
                        label={a.email}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
