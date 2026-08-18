-- Phase 6: outbound C2LPHL links for Steps 5 and 6.
--
-- Cycle-specific copy lives in the database as admin-editable settings, never
-- hardcoded (see CLAUDE.md conventions). Seeded empty: the step pages render
-- their link button only when the value is non-empty, so applying this
-- migration is never blocking — the steps work either way, and staff fill the
-- URLs in when C2LPHL publishes them (they arrive late most cycles).
--
-- Idempotent: `on conflict do nothing` against the (cycle_id, key) unique
-- constraint, so re-running never clobbers a URL staff have already set.

insert into public.cycle_settings (cycle_id, key, value)
select c.id, k.key, '""'::jsonb
from public.cycles c
cross join (values ('c2l_application_url'), ('c2l_documents_url')) as k(key)
where c.is_active
on conflict (cycle_id, key) do nothing;
