-- Phase 8: backfill the interview track for applications created before
-- auto-assignment existed.
--
-- Track A = partner school (Launchpad interviews on site), Track B = everyone
-- else, including graduates and "Other" free-text schools (PRD, Step 4).
--
-- Only touches rows where track is still null AND no staff override is
-- recorded, so it can never undo a human decision. Safe to re-run.

update public.applications a
set track = case when s.is_partner then 'A' else 'B' end::interview_track
from public.schools s
where a.school_id = s.id
  and a.track is null
  and a.track_overridden = false;

-- Free-text ("Other") schools aren't partners by definition.
update public.applications
set track = 'B'::interview_track
where school_id is null
  and school_other is not null
  and track is null
  and track_overridden = false;
