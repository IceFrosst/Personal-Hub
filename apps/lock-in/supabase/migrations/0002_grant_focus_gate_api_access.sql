-- Expose focus_gate to the PostgREST API.
-- The schema and its tables must be granted to anon + authenticated, and the
-- schema must be in PostgREST's exposed-schema list (set via Supabase project
-- config: db_schema = 'public,graphql_public,hub,focus_gate'). RLS still gates
-- per-row, this just unlocks the door.
-- Already applied to project qcsyihymmaktkbqfxlkl on 2026-05-28.

grant usage on schema focus_gate to anon, authenticated, service_role;

grant all on all tables in schema focus_gate
  to anon, authenticated, service_role;

grant all on all sequences in schema focus_gate
  to anon, authenticated, service_role;

alter default privileges in schema focus_gate
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema focus_gate
  grant all on sequences to anon, authenticated, service_role;
