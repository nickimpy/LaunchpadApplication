-- Phase 3: placeholder step deadlines for the active cycle.
-- step_deadlines is a JSON map of step number → ISO date, admin-editable in
-- the dashboard (Phase 7+). Only fills the setting if it is still the empty
-- placeholder from the Phase 1 seed, so re-running never clobbers staff edits.

update public.cycle_settings
set value = '{
  "1": "2027-01-15",
  "2": "2027-01-31",
  "3": "2027-01-31",
  "4": "2027-03-01",
  "5": "2027-03-15",
  "6": "2027-03-15",
  "7": "2027-04-15"
}'::jsonb
where key = 'step_deadlines'
  and value = '{}'::jsonb
  and cycle_id = (select id from public.cycles where is_active);
