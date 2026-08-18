-- Phase 8 follow-up: a third state for C2L review, plus a staff message.
--
-- Staff need to distinguish "I haven't looked yet" from "I looked and it was
-- wrong". Before this, un-verifying a step was indistinguishable from never
-- having reviewed it, and there was nowhere to tell the student WHAT was
-- missing — so they'd have no idea what to fix.
--
-- 'needs_attention' is deliberately NOT added to the statuses a student may
-- set: step_progress_own_update's WITH CHECK lists the allowed values, and
-- this isn't among them, so only staff can flag a step. Students CAN move out
-- of it (the USING clause doesn't restrict the current status), which is
-- exactly the re-report flow we want.
--
-- Run this on its own: Postgres won't let a new enum value be used in the same
-- transaction that adds it.

alter type step_status add value if not exists 'needs_attention';

-- What the student needs to fix, written by staff. Generic to any step, though
-- only Steps 5 and 6 use it today.
alter table public.step_progress
  add column if not exists staff_note text;
