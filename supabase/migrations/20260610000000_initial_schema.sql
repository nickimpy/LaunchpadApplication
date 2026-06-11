-- Launchpad Application Portal — initial schema (Build Plan Phase 1)
-- Apply via Supabase SQL editor or `psql $DATABASE_URL -f <this file>`,
-- then apply 20260610000001_seed.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type notification_preference as enum ('email', 'sms', 'both');
create type program_choice as enum ('lightspeed', 'foundations');
create type interview_track as enum ('A', 'B');
create type step_status as enum (
  'not_started', 'in_progress', 'submitted', 'pending_verification', 'complete'
);
create type decision_status as enum (
  'offer_extended', 'waitlisted', 'denied', 'withdrew',
  'acceptance_rescinded', 'offer_accepted', 'offer_not_accepted', 'ineligible'
);
create type rubric_criterion as enum (
  'passion', 'purpose', 'persistence', 'collaboration',
  'prior_knowledge', 'external_support', 'communication'
);
create type pathway_preference as enum (
  'el_only', 'leaning_el', 'open_to_either', 'leaning_tech', 'tech_only'
);
create type availability_answer as enum ('yes', 'no', 'not_sure');
create type iep_answer as enum ('yes', 'no', 'prefer_not_to_disclose');
create type parent_college_answer as enum (
  'both', 'one', 'neither', 'dont_know', 'prefer_not_to_say'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text,
  last_name text,
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  invited_by uuid references public.admin_users (id),
  created_at timestamptz not null default now()
);

-- security definer so RLS policies (including on admin_users itself)
-- can check admin status without recursing
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users where id = auth.uid() and is_active and is_super_admin
  );
$$;

-- ---------------------------------------------------------------------------
-- Cycles & admin-editable copy
-- ---------------------------------------------------------------------------

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- one active cycle at a time
create unique index cycles_one_active on public.cycles (is_active) where is_active;

-- cycle-specific copy (summer dates/location, program info, consent text,
-- step deadlines, contact point) lives here, never hardcoded
create table public.cycle_settings (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (cycle_id, key)
);

create trigger cycle_settings_updated_at before update on public.cycle_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Schools (seeded from school-dropdown-options.json; match by id, never name)
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_partner boolean not null default false, -- Track A partner school
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Students & applications
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  email text not null unique,
  phone text not null,
  date_of_birth date not null,
  notification_preference notification_preference not null default 'email',
  sms_opt_in_confirmed boolean not null default false,
  -- never-expiring public status link token (status only, no PII)
  public_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  cycle_id uuid not null references public.cycles (id),
  -- Step 1: address
  street text,
  street_2 text,
  city text,
  state text,
  zip text,
  -- Step 1: academic
  school_id uuid references public.schools (id),
  school_other text, -- free text when school = Other
  gpa numeric(4, 2),
  graduation_year text
    check (graduation_year in ('Before 2024', '2024', '2025', '2026', '2027')),
  referral_source text,
  -- Step 1: program selection
  program program_choice,
  -- program-specific question block; exact 2026 form fields land in Phase 4
  program_answers jsonb not null default '{}'::jsonb,
  college_warning_flagged boolean not null default false, -- flag for staff review
  -- interview track: auto-assigned from partner school, staff can override
  track interview_track,
  track_overridden boolean not null default false,
  -- tokenized parent form link (no parent login); regenerable
  parent_link_token uuid not null unique default gen_random_uuid(),
  parent_link_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, cycle_id)
);

create index applications_cycle_idx on public.applications (cycle_id);
create index applications_school_idx on public.applications (school_id);

create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- Funder reporting ONLY. Kept out of applications so demographic data can
-- never leak into application logic, and so access can be locked tighter.
create table public.demographics (
  application_id uuid primary key references public.applications (id) on delete cascade,
  gender text,
  gender_other text,
  pronouns text,
  pronouns_other text,
  race_ethnicity text[],
  race_ethnicity_other text,
  household_income text,
  household_size smallint,
  parent_college parent_college_answer,
  updated_at timestamptz not null default now()
);

create trigger demographics_updated_at before update on public.demographics
  for each row execute function public.set_updated_at();

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  position smallint not null check (position in (1, 2)),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  relationship text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, position)
);

create trigger guardians_updated_at before update on public.guardians
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step engine: one row per application per step (1-7)
-- ---------------------------------------------------------------------------

create table public.step_progress (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  step_number smallint not null check (step_number between 1 and 7),
  status step_status not null default 'not_started',
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_by uuid, -- auth uid of student or admin who last changed it
  updated_at timestamptz not null default now(),
  unique (application_id, step_number)
);

create index step_progress_status_idx on public.step_progress (step_number, status);

create trigger step_progress_updated_at before update on public.step_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 2: parent form (tokenized, no login; written via server routes only)
-- ---------------------------------------------------------------------------

create table public.parent_form_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  wants_program_info boolean,
  availability availability_answer not null,
  availability_concerns text, -- shown when availability is no / not_sure
  iep iep_answer,
  comments text,
  parent_first_name text not null,
  parent_last_name text not null,
  parent_relationship text not null,
  parent_email text not null,
  parent_phone text not null,
  -- snapshot of the consent copy agreed to (copy itself is admin-editable)
  consent_text_snapshot text not null,
  -- native e-signature: image in Storage + typed name + timestamp + IP
  signature_image_path text not null,
  signature_typed_name text not null,
  signed_at timestamptz not null default now(),
  signer_ip inet,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Step 3: essays (prompts are admin-editable data, not code)
-- ---------------------------------------------------------------------------

create table public.essay_prompts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles (id) on delete cascade,
  prompt text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.essay_responses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  prompt_id uuid not null references public.essay_prompts (id),
  response text not null default '',
  updated_at timestamptz not null default now(),
  unique (application_id, prompt_id)
);

create trigger essay_responses_updated_at before update on public.essay_responses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 4: interviews (rubric criteria normalized into interview_scores)
-- ---------------------------------------------------------------------------

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  interview_date date,
  interviewers text,
  pathway_preference pathway_preference,
  schedule_conflicts text,
  college_plans text,
  overall_notes text,
  final_rating smallint check (final_rating between 0 and 3),
  recorded_by uuid references public.admin_users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger interviews_updated_at before update on public.interviews
  for each row execute function public.set_updated_at();

create table public.interview_scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  criterion rubric_criterion not null,
  score smallint not null check (score between 0 and 3),
  note text,
  unique (interview_id, criterion)
);

-- ---------------------------------------------------------------------------
-- Step 7: decisions (hidden from student until released_at is set)
-- ---------------------------------------------------------------------------

create table public.decisions (
  application_id uuid primary key references public.applications (id) on delete cascade,
  status decision_status not null,
  decided_by uuid references public.admin_users (id),
  decided_at timestamptz not null default now(),
  -- set only when an admin manually triggers the decision email
  released_at timestamptz,
  released_by uuid references public.admin_users (id),
  notes text,
  updated_at timestamptz not null default now()
);

create trigger decisions_updated_at before update on public.decisions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staff operations
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  doc_type text not null check (doc_type in ('transcript', 'attendance', 'iep_504', 'other')),
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references public.admin_users (id),
  created_at timestamptz not null default now()
);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references public.admin_users (id),
  body text not null,
  created_at timestamptz not null default now()
);

-- append-only: who/what/when for student-info edits, interview/status
-- updates, and anything decision-related
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_email text,
  action text not null,      -- e.g. 'student.update', 'decision.record'
  entity_type text not null, -- e.g. 'student', 'application', 'decision'
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create table public.notification_log (
  id bigint generated always as identity primary key,
  student_id uuid references public.students (id) on delete set null,
  application_id uuid references public.applications (id) on delete set null,
  recipient text not null, -- email address or phone number
  channel text not null check (channel in ('email', 'sms')),
  template text not null,      -- which message was sent
  trigger_event text not null, -- what caused it (e.g. 'step1_complete')
  status text not null default 'sent',
  payload jsonb,
  sent_at timestamptz not null default now()
);

create index notification_log_student_idx on public.notification_log (student_id);

-- ---------------------------------------------------------------------------
-- Storage buckets (private; served via signed URLs / server routes)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false), ('signatures', 'signatures', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.admin_users enable row level security;
alter table public.cycles enable row level security;
alter table public.cycle_settings enable row level security;
alter table public.schools enable row level security;
alter table public.students enable row level security;
alter table public.applications enable row level security;
alter table public.demographics enable row level security;
alter table public.guardians enable row level security;
alter table public.step_progress enable row level security;
alter table public.parent_form_submissions enable row level security;
alter table public.essay_prompts enable row level security;
alter table public.essay_responses enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_scores enable row level security;
alter table public.decisions enable row level security;
alter table public.documents enable row level security;
alter table public.admin_notes enable row level security;
alter table public.audit_log enable row level security;
alter table public.notification_log enable row level security;

-- ownership check: does the application belong to the signed-in student?
create or replace function public.owns_application(app_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from applications where id = app_id and student_id = auth.uid()
  );
$$;

-- admin_users: admins can see the staff list; only the super admin manages it
create policy admin_users_select on public.admin_users
  for select using (public.is_admin());
create policy admin_users_write on public.admin_users
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- reference data: any signed-in user can read; only admins write
create policy cycles_select on public.cycles
  for select to authenticated using (true);
create policy cycles_admin on public.cycles
  for all using (public.is_admin()) with check (public.is_admin());

create policy cycle_settings_select on public.cycle_settings
  for select to authenticated using (true);
create policy cycle_settings_admin on public.cycle_settings
  for all using (public.is_admin()) with check (public.is_admin());

create policy schools_select on public.schools
  for select to authenticated using (true);
create policy schools_admin on public.schools
  for all using (public.is_admin()) with check (public.is_admin());

create policy essay_prompts_select on public.essay_prompts
  for select to authenticated using (true);
create policy essay_prompts_admin on public.essay_prompts
  for all using (public.is_admin()) with check (public.is_admin());

-- students: own row only; admins full access
create policy students_own_select on public.students
  for select using (id = auth.uid());
create policy students_own_insert on public.students
  for insert with check (id = auth.uid());
create policy students_own_update on public.students
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy students_admin on public.students
  for all using (public.is_admin()) with check (public.is_admin());

-- applications: own rows; admins full access
create policy applications_own_select on public.applications
  for select using (student_id = auth.uid());
create policy applications_own_insert on public.applications
  for insert with check (student_id = auth.uid());
create policy applications_own_update on public.applications
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy applications_admin on public.applications
  for all using (public.is_admin()) with check (public.is_admin());

-- demographics: student edits their own (Step 1 is editable after submit);
-- admins read for funder reporting but the data drives no logic
create policy demographics_own on public.demographics
  for all using (public.owns_application(application_id))
  with check (public.owns_application(application_id));
create policy demographics_admin_select on public.demographics
  for select using (public.is_admin());

-- guardians: student edits their own; admins full access (re-send link, fix contacts)
create policy guardians_own on public.guardians
  for all using (public.owns_application(application_id))
  with check (public.owns_application(application_id));
create policy guardians_admin on public.guardians
  for all using (public.is_admin()) with check (public.is_admin());

-- step progress: students see their own and may move ONLY student-owned
-- steps (1, 3, 5, 6), never to 'complete' for 5/6 — staff verify those.
-- Steps 2 (parent, via server) and 4/7 (staff) change server-side or by admins.
create policy step_progress_own_select on public.step_progress
  for select using (public.owns_application(application_id));
create policy step_progress_own_insert on public.step_progress
  for insert with check (
    public.owns_application(application_id)
    and step_number in (1, 3, 5, 6)
    and (
      step_number in (1, 3)
      or status in ('not_started', 'in_progress', 'submitted', 'pending_verification')
    )
  );
create policy step_progress_own_update on public.step_progress
  for update using (
    public.owns_application(application_id) and step_number in (1, 3, 5, 6)
  )
  with check (
    public.owns_application(application_id)
    and step_number in (1, 3, 5, 6)
    and (
      step_number in (1, 3)
      or status in ('not_started', 'in_progress', 'submitted', 'pending_verification')
    )
  );
create policy step_progress_admin on public.step_progress
  for all using (public.is_admin()) with check (public.is_admin());

-- parent form: no client access at all; the tokenized page reads/writes
-- through server routes with the service role. Admins can view submissions.
create policy parent_form_admin_select on public.parent_form_submissions
  for select using (public.is_admin());

-- essays: student edits their own; admins read
create policy essay_responses_own on public.essay_responses
  for all using (public.owns_application(application_id))
  with check (public.owns_application(application_id));
create policy essay_responses_admin_select on public.essay_responses
  for select using (public.is_admin());

-- staff-only tables
create policy interviews_admin on public.interviews
  for all using (public.is_admin()) with check (public.is_admin());
create policy interview_scores_admin on public.interview_scores
  for all using (public.is_admin()) with check (public.is_admin());
create policy documents_admin on public.documents
  for all using (public.is_admin()) with check (public.is_admin());
create policy admin_notes_admin on public.admin_notes
  for all using (public.is_admin()) with check (public.is_admin());
create policy notification_log_admin on public.notification_log
  for all using (public.is_admin()) with check (public.is_admin());

-- audit log: append-only, staff-readable; no update/delete policies exist
create policy audit_log_select on public.audit_log
  for select using (public.is_admin());
create policy audit_log_insert on public.audit_log
  for insert with check (public.is_admin());

-- decisions: staff manage; students see their own ONLY once released
create policy decisions_admin on public.decisions
  for all using (public.is_admin()) with check (public.is_admin());
create policy decisions_student_released on public.decisions
  for select using (
    released_at is not null and public.owns_application(application_id)
  );

-- storage: staff read/write app documents and read signatures;
-- signatures are written server-side (service role) by the parent form
create policy storage_documents_admin on storage.objects
  for all using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());
create policy storage_signatures_admin_select on storage.objects
  for select using (bucket_id = 'signatures' and public.is_admin());
