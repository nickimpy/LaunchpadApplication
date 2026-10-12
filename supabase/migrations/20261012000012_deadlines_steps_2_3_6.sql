-- Deadlines (Nick, 2026-10-12): Steps 2 and 3 move to Feb 15, 2027 (same as
-- Step 1 — they used to fall BEFORE it), Step 6 moves to May 1, 2027.
-- Merges into the existing map, leaving the other steps alone. Re-runnable.
-- (Once the admin Settings page ships, staff can change these there instead.)

update public.cycle_settings
set value = value || '{
  "2": "2027-02-15",
  "3": "2027-02-15",
  "6": "2027-05-01"
}'::jsonb
where key = 'step_deadlines'
  and cycle_id = (select id from public.cycles where is_active);
