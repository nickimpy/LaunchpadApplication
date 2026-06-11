-- Table-level grants. RLS (already enabled on every table) is the real
-- gatekeeper for which ROWS a user can touch; these grants just let the
-- signed-in role through the door so RLS can do its job.
--
-- anon deliberately gets NOTHING: logged-out pages (parent form, public
-- status link) only reach the database through server routes using the
-- secret/service-role key.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

grant usage, select on all sequences in schema public
  to authenticated, service_role;

grant execute on all functions in schema public
  to authenticated, service_role;

-- future tables/sequences/functions created via the SQL editor (as
-- postgres) get the same grants automatically
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to authenticated, service_role;
