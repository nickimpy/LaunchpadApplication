-- Phase 4 (Step 1): widen the graduation_year check constraint.
-- The 2026 cycle accepts grads of 'Before 2025' .. '2028'; the original
-- schema enumerated 'Before 2024' .. '2027'. Drop and re-add the constraint.
-- (Inline column checks are auto-named <table>_<column>_check.)

alter table public.applications
  drop constraint if exists applications_graduation_year_check;

alter table public.applications
  add constraint applications_graduation_year_check
  check (graduation_year in ('Before 2025', '2025', '2026', '2027', '2028'));
