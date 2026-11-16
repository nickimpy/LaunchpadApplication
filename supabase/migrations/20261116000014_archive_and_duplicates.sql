-- Archive + duplicate handling (2026-11-16).
--
-- One general "archive" for applications that should leave the active
-- pipeline without being deleted: duplicates, withdrawals, ineligible, test or
-- spam signups, and accounts never email-verified (auto-archived after 30
-- days). Archived applications are hidden from lists, counts and reminders,
-- stay findable under "Show archived", and can be restored. Idempotent.

alter table public.applications
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.admin_users (id),
  add column if not exists archive_reason text
    check (archive_reason in ('duplicate', 'withdrew', 'ineligible', 'test_spam', 'never_verified', 'other')),
  add column if not exists archive_note text,
  add column if not exists duplicate_of uuid references public.applications (id);

create index if not exists applications_archived_idx on public.applications (archived_at);

-- Pairs staff confirmed are NOT the same person (twins, shared names), so the
-- "possible duplicates" panel stops suggesting them. Stored with the smaller
-- id first so each pair has exactly one row.
create table if not exists public.duplicate_dismissals (
  app_a uuid not null references public.applications (id) on delete cascade,
  app_b uuid not null references public.applications (id) on delete cascade,
  dismissed_by uuid references public.admin_users (id),
  dismissed_at timestamptz not null default now(),
  primary key (app_a, app_b),
  check (app_a < app_b)
);
alter table public.duplicate_dismissals enable row level security;
drop policy if exists duplicate_dismissals_admin on public.duplicate_dismissals;
create policy duplicate_dismissals_admin on public.duplicate_dismissals
  for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, delete on public.duplicate_dismissals to authenticated;

-- Students may never archive/restore themselves (withdrawal is staff-only):
-- extend the existing student-write guard from migration 0011.
create or replace function public.guard_application_student_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_student_request() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.student_id is distinct from old.student_id
     or new.cycle_id is distinct from old.cycle_id
     or new.created_at is distinct from old.created_at
     or new.self_release is distinct from old.self_release
     or new.college_warning_flagged is distinct from old.college_warning_flagged
     or new.college_warning_resolved_at is distinct from old.college_warning_resolved_at
     or new.college_warning_resolved_by is distinct from old.college_warning_resolved_by
     or new.college_warning_resolution is distinct from old.college_warning_resolution
     or new.track is distinct from old.track
     or new.track_overridden is distinct from old.track_overridden
     or new.archived_at is distinct from old.archived_at
     or new.archived_by is distinct from old.archived_by
     or new.archive_reason is distinct from old.archive_reason
     or new.archive_note is distinct from old.archive_note
     or new.duplicate_of is distinct from old.duplicate_of
  then
    raise exception 'You can''t change that field.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_application_student_update() from public, anon, authenticated;
