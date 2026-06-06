-- Expose cookie_jar to the PostgREST API.
-- The schema + its tables must be granted to anon + authenticated, AND the
-- schema must be added to PostgREST's exposed-schema list (Supabase project
-- config: db_schema = 'public,graphql_public,hub,focus_gate,cookie_jar').
-- RLS still gates every row — this just unlocks the door.

grant usage on schema cookie_jar to anon, authenticated, service_role;

grant all on all tables in schema cookie_jar
  to anon, authenticated, service_role;

grant all on all sequences in schema cookie_jar
  to anon, authenticated, service_role;

alter default privileges in schema cookie_jar
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema cookie_jar
  grant all on sequences to anon, authenticated, service_role;
