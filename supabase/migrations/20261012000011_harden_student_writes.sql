-- Security hardening: what a logged-in STUDENT may change about their own rows.
--
-- PASTE INTO THE SUPABASE SQL EDITOR *BEFORE* deploying the matching code.
-- Idempotent (create or replace / drop if exists).
--
-- The problem: row-level security decides WHICH ROWS a student may update
-- (their own), but not WHICH COLUMNS. Anyone signed in can call the database
-- API directly with their own login, skipping every check in the app. Before
-- this migration a student could, for example, set self_release = true and
-- sign their own records release while under 18, clear their college-plan
-- flag, mark it "resolved", change their date of birth past the age limit, or
-- undo a C2L step staff had already verified.
--
-- The fix: BEFORE triggers that reject changes to protected columns unless
-- the caller is staff (is_admin()) or the server (service role). The app now
-- writes those columns server-side after its own checks, so nothing
-- legitimate breaks. Students also lose INSERT on these tables — accounts,
-- applications and step rows are only ever created by the server.

-- ---------------------------------------------------------------------------
-- Helper: is this request a signed-in, non-staff user (i.e. a student)?
-- The service role (server) and staff both bypass the guards below.
-- ---------------------------------------------------------------------------

create or replace function public.is_student_request()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.role(), '') = 'authenticated' and not public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

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
     -- age-gated: only the server sets this, after checking they're 18+
     or new.self_release is distinct from old.self_release
     -- staff review fields
     or new.college_warning_flagged is distinct from old.college_warning_flagged
     or new.college_warning_resolved_at is distinct from old.college_warning_resolved_at
     or new.college_warning_resolved_by is distinct from old.college_warning_resolved_by
     or new.college_warning_resolution is distinct from old.college_warning_resolution
     or new.track is distinct from old.track
     or new.track_overridden is distinct from old.track_overridden
  then
    raise exception 'You can''t change that field.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_guard_student_update on public.applications;
create trigger applications_guard_student_update
  before update on public.applications
  for each row execute function public.guard_application_student_update();

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------

create or replace function public.guard_student_self_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_student_request() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.public_token is distinct from old.public_token
     or new.sms_opt_in_confirmed is distinct from old.sms_opt_in_confirmed
     or new.created_at is distinct from old.created_at
     -- the age rule lives on this; the server validates it, then writes it
     or new.date_of_birth is distinct from old.date_of_birth
     -- the login email may only be mirrored from the verified auth email
     or (new.email is distinct from old.email
         and lower(new.email) is distinct from lower(coalesce(auth.jwt() ->> 'email', '')))
  then
    raise exception 'You can''t change that field.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists students_guard_self_update on public.students;
create trigger students_guard_self_update
  before update on public.students
  for each row execute function public.guard_student_self_update();

-- ---------------------------------------------------------------------------
-- step_progress
-- ---------------------------------------------------------------------------

create or replace function public.guard_step_student_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_student_request() then
    return new;
  end if;
  if new.application_id is distinct from old.application_id
     or new.step_number is distinct from old.step_number
     -- staff's "what's missing" note is theirs to write
     or new.staff_note is distinct from old.staff_note
     -- staff verification of a C2L step is final from the student's side
     or (old.step_number in (5, 6) and old.status = 'complete')
  then
    raise exception 'You can''t change that step.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists step_progress_guard_student_update on public.step_progress;
create trigger step_progress_guard_student_update
  before update on public.step_progress
  for each row execute function public.guard_step_student_update();

-- ---------------------------------------------------------------------------
-- No student-side inserts: the server provisions these rows.
-- ---------------------------------------------------------------------------

drop policy if exists students_own_insert on public.students;
drop policy if exists applications_own_insert on public.applications;
drop policy if exists step_progress_own_insert on public.step_progress;
