-- Phase 10b: let staff resolve the college-plan flag.
--
-- PASTE INTO THE SUPABASE SQL EDITOR *BEFORE* deploying the matching code — the
-- applicant list and profile read these columns. Idempotent (IF NOT EXISTS).
--
-- college_warning_flagged stays as-is: it reflects the student's own answer and
-- Step 1 recomputes it on every save. Resolution is a separate staff fact
-- layered on top, so a flag can be "raised" and "resolved" at the same time.

alter table public.applications
  add column if not exists college_warning_resolved_at timestamptz,
  add column if not exists college_warning_resolved_by uuid
    references public.admin_users (id),
  add column if not exists college_warning_resolution text;
