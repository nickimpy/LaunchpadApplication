-- Phase 7: create the first super admin.
--
-- Chicken-and-egg: admin_users_write requires is_super_admin(), so the very
-- first row can't be created from the app — only here (or by any service-role
-- caller). Every later admin is invited through /admin/staff.
--
-- HOW TO USE: set the email below to the account that should hold super admin,
-- then run this in the Supabase SQL editor. That email must already have signed
-- up (an auth.users row must exist) — sign up through /signup first if needed.
--
-- NOTE: at Launchpad, staff emails are also used by students, so one auth user
-- can legitimately be both a student and an admin. The app handles that: the
-- dashboard links to "My application" and the portal links back. If you would
-- rather keep them separate, bootstrap a different address here.
--
-- Idempotent: re-running only re-asserts the flags, never duplicates.

do $$
declare
  target_email constant text := 'nick@launchpadphilly.org';
  target_id uuid;
begin
  select id into target_id from auth.users where lower(email) = lower(target_email);

  if target_id is null then
    raise notice 'No auth user for %. Sign up with that email first, then re-run.', target_email;
    return;
  end if;

  insert into public.admin_users (id, email, is_super_admin, is_active)
  values (target_id, lower(target_email), true, true)
  on conflict (id) do update
    set is_super_admin = true,
        is_active = true,
        email = excluded.email;

  raise notice 'Super admin ready: %', target_email;
end $$;
