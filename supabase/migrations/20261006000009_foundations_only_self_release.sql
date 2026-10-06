-- Phase 10: Foundations-only application, 18+ self-signed records release, and
-- the 2027-28 cohort copy/dates.
--
-- PASTE THIS INTO THE SUPABASE SQL EDITOR *BEFORE* DEPLOYING the matching code:
-- the new Step 1 form reads/writes applications.self_release, so the column has
-- to exist first. (The portal shell and parent form tolerate it being absent,
-- but Step 1 saves will fail until it's there.)
--
-- Idempotent: the column uses IF NOT EXISTS and every setting is an upsert, so
-- re-running is safe. NOTE the settings below deliberately OVERWRITE the current
-- values for those keys (they are the approved 2027-28 copy) — if staff have
-- hand-edited any of them since, re-apply those edits afterwards. The two C2L
-- URLs are the exception: they are only filled in if still empty.

-- ---------------------------------------------------------------------------
-- 18+ applicants who sign their own records release
-- ---------------------------------------------------------------------------

alter table public.applications
  add column if not exists self_release boolean not null default false;

-- ---------------------------------------------------------------------------
-- Cycle settings (admin-editable copy, never hardcoded in the app)
-- ---------------------------------------------------------------------------

with c as (select id from public.cycles where is_active)
insert into public.cycle_settings (cycle_id, key, value)
select c.id, s.key, s.value
from c, (values
  ('contact_email', to_jsonb('apply@launchpadphilly.org'::text)),
  ('cohort_label', to_jsonb('2027-28'::text)),
  ('summer_location', to_jsonb('801 Market St, Philadelphia, PA'::text)),
  ('summer_dates', to_jsonb('July 6, 2027 to August 12, 2027'::text)),
  -- Age rule: applicants must be this age or younger on the program start date.
  ('program_start_date', to_jsonb('2027-07-06'::text)),
  ('max_enrollment_age', to_jsonb(22)),
  -- Shown to parents who ask to "learn a bit more". Light markup: **bold**,
  -- [label](url), blank line between paragraphs.
  ('program_info_foundations', to_jsonb($info$**What is Launchpad?**

Launchpad is a training program that seeks to connect high schoolers to high paying careers using AI. Students enter the program as 11th, 12th graders or recent HS grads and leave as accomplished young professionals, ready to enter the workforce or take on additional training.

**What is the time commitment?**

Launchpad is broken up into three phases, each with its own time commitment.

**Foundations (July 2027 → Aug 2027)**

Foundations is a six week summer program starting July 2027. Sessions will run 9am-3pm on Mon, Tue, Wed, Thur.

**101 - School Year (Sept 2027 → May 2028)**

101 is 4 days/week in the afternoon. Students who will be seniors for 101 must be eligible for Work Release to participate in the program and make this time commitment.

**101 - Internships (June 2028 → August 2028)**

Upon earning their certifications, students complete paid internships with Launchpad’s employer partners. Internship schedules vary based on placement and employer needs.

**What does my student earn?**

Your student will earn $1,320 in Foundations and $4,500 in 101

**What if I have more questions?**

If you have more questions you can visit our [website](http://www.launchpadphilly.org) or email [info@launchpadphilly.org](mailto:info@launchpadphilly.org)$info$::text)),
  -- Parent/guardian version, signed by a parent.
  ('parent_form_consent_text', to_jsonb($consent$The Launchpad application requires submission of original transcripts, most recent standardized test scores, attendance information, disciplinary records, IEP, ELL and 504 plan if applicable. Launchpad will need continuous access to this information for the duration of a student’s enrollment in the program, including, but not limited to, 12th grade report cards and final high school transcripts. In addition to records, Launchpad staff will conduct interviews and invite applicants to participate in an in person hackathon.

By electronically signing this form, I give my permission for the above information to be released by the above High School to Launchpad at 801 Market St Philadelphia, PA 19107 and grant permission for Launchpad to work with my student throughout the applications process.$consent$::text)),
  -- Same agreement in the first person, for applicants 18+ who sign their own.
  -- DRAFT for Nick/legal review: adapted from the parent text above.
  ('student_release_consent_text', to_jsonb($self$The Launchpad application requires submission of my original transcripts, most recent standardized test scores, attendance information, disciplinary records, IEP, ELL and 504 plan if applicable. Launchpad will need continuous access to this information for the duration of my enrollment in the program, including, but not limited to, 12th grade report cards and final high school transcripts. In addition to records, Launchpad staff will conduct interviews and invite me to participate in an in person hackathon.

By electronically signing this form, I give my permission for the above information about me to be released by the above High School to Launchpad at 801 Market St Philadelphia, PA 19107 and grant permission for Launchpad to work with me throughout the applications process.$self$::text))
) as s (key, value)
on conflict (cycle_id, key) do update set value = excluded.value;

-- C2LPHL's site, only where staff haven't already set something else.
with c as (select id from public.cycles where is_active)
insert into public.cycle_settings (cycle_id, key, value)
select c.id, k.key, to_jsonb('https://c2lphl.org'::text)
from c, (values ('c2l_application_url'), ('c2l_documents_url')) as k (key)
on conflict (cycle_id, key) do update set value = excluded.value
  where public.cycle_settings.value = '""'::jsonb;

-- Step deadlines: merge only the four dates that changed, leaving the rest.
--   Step 1 Student Information ........ Feb 15, 2027
--   Step 4 Interview .................. Apr 1, 2027
--   Step 5 C2LPHL Application ......... Mar 30, 2027
--   Step 7 Admissions Decision ........ May 1, 2027
-- (Steps 2, 3 and 6 keep their existing placeholder dates — see CLAUDE.md.)
update public.cycle_settings
set value = value || '{
  "1": "2027-02-15",
  "4": "2027-04-01",
  "5": "2027-03-30",
  "7": "2027-05-01"
}'::jsonb
where key = 'step_deadlines'
  and cycle_id = (select id from public.cycles where is_active);
