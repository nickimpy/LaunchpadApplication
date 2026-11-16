-- Fixes from Supabase's security + performance advisors (2026-11-06).
-- Applied by Claude via the Supabase MCP. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Nothing callable through the public API that doesn't need to be.
-- ---------------------------------------------------------------------------

-- Trigger / event-trigger functions only ever run automatically. EXECUTE is
-- checked when a trigger is CREATED, not when it fires, so revoking it from
-- API roles changes nothing about how they run.
revoke execute on function public.guard_application_student_update() from public, anon, authenticated;
revoke execute on function public.guard_student_self_update()        from public, anon, authenticated;
revoke execute on function public.guard_step_student_update()        from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()                  from public, anon, authenticated;

-- Helpers used INSIDE row-level-security policies and triggers. Signed-in users
-- must keep EXECUTE (policies run as the caller); signed-out visitors never
-- touch these tables (anon has no table grants — migration 0002), so they lose it.
revoke execute on function public.is_admin()                from public, anon;
revoke execute on function public.is_super_admin()          from public, anon;
revoke execute on function public.owns_application(uuid)    from public, anon;
revoke execute on function public.is_student_request()      from public, anon;
grant  execute on function public.is_admin()                to authenticated;
grant  execute on function public.is_super_admin()          to authenticated;
grant  execute on function public.owns_application(uuid)    to authenticated;
grant  execute on function public.is_student_request()      to authenticated;

-- Pin the lookup path (advisor: function_search_path_mutable).
alter function public.set_updated_at() set search_path = public;

-- ---------------------------------------------------------------------------
-- 2. Evaluate auth.uid() once per query, not once per row (auth_rls_initplan).
--    Same rules, just written so Postgres caches the value.
-- ---------------------------------------------------------------------------

drop policy if exists students_own_select on public.students;
create policy students_own_select on public.students
  for select using (id = (select auth.uid()));

drop policy if exists students_own_update on public.students;
create policy students_own_update on public.students
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists applications_own_select on public.applications;
create policy applications_own_select on public.applications
  for select using (student_id = (select auth.uid()));

drop policy if exists applications_own_update on public.applications;
create policy applications_own_update on public.applications
  for update using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Indexes for the queries that run constantly.
-- ---------------------------------------------------------------------------

-- "Already sent this reminder?" (alreadySent) and the profile's message history.
create index if not exists notification_log_application_trigger_idx
  on public.notification_log (application_id, trigger_event);
-- Anti-spam caps: messages to one address/number in the last 24h.
create index if not exists notification_log_recipient_recent_idx
  on public.notification_log (channel, recipient, sent_at);
-- Applicant profile loads.
create index if not exists documents_application_idx   on public.documents (application_id);
create index if not exists admin_notes_application_idx on public.admin_notes (application_id);
create index if not exists essay_responses_prompt_idx  on public.essay_responses (prompt_id);
create index if not exists essay_prompts_cycle_idx     on public.essay_prompts (cycle_id);
