-- Republic (Dictatorship of Ignas): a real, global, sequential applicant
-- number shared by every visitor — replaces the old per-device random
-- number that used to live only in localStorage (see apps/republic/lib/api.ts
-- and CLAUDE.md). Additive-only per SCHEMA_RULES.md: creates the `republic`
-- schema (none existed before this migration), a sequence, and a
-- SECURITY DEFINER RPC wrapping it. Idempotent — safe to re-run.
--
-- Each browser/device calls `republic.next_applicant_number()` at most ONCE
-- (the client caches the result in localStorage — see
-- lib/api.ts#getApplicantNumber) so every visitor gets a distinct,
-- monotonically increasing number, but nobody burns a number just by
-- reloading the page.

create schema if not exists republic;

-- Starts at 1 so the displayed value is the real number of globally assigned
-- applicants, rather than carrying forward the old random range's fiction.
create sequence if not exists republic.applicant_number_seq
  as bigint
  start with 1
  increment by 1
  no maxvalue
  no cycle;

-- SECURITY DEFINER: runs with the function owner's privileges, so callers
-- never need direct USAGE on the sequence itself — only EXECUTE on this
-- function, granted below. `search_path` is pinned explicitly (rather than
-- left to whatever the calling role's default is) so this function can
-- never be tricked into resolving `nextval`/the sequence name against an
-- attacker-controlled schema earlier in an unpinned search_path.
create or replace function republic.next_applicant_number()
returns bigint
language sql
security definer
set search_path = republic, pg_temp
as $$
  select nextval('republic.applicant_number_seq');
$$;

comment on function republic.next_applicant_number() is
  'Returns the next value in the global applicant-number sequence. Called at most once per browser/device — the client caches the result in localStorage. See apps/republic/lib/api.ts#getApplicantNumber.';

-- Expose the schema + function (but never the raw sequence) to PostgREST so
-- anon/authenticated clients can call the RPC directly:
--   POST {SUPABASE_URL}/rest/v1/rpc/next_applicant_number
--   headers: apikey, Authorization, Content-Profile: republic
-- (RPC calls are POSTs, so the custom schema is named via the
-- Content-Profile header — same mechanism apps/republic/lib/api.ts already
-- uses for table writes — never a dot-qualified path segment.)
grant usage on schema republic to anon, authenticated;
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, which would
-- hand every role in the database (not just anon/authenticated) the ability to
-- burn sequence values via this SECURITY DEFINER function. Revoke that default
-- before granting explicitly to just the two roles PostgREST actually calls as.
revoke execute on function republic.next_applicant_number() from public;
grant execute on function republic.next_applicant_number() to anon, authenticated;

-- Data API exposure reminder (see ../../../../SCHEMA_RULES.md's "New Postgres
-- schemas" section) — applying this SQL alone is not enough for PostgREST to
-- see it. After running this migration:
--   1. Add `republic` to the project's exposed-schema list (dashboard config
--      `db_schema`, or `PATCH /v1/projects/<ref>/postgrest`).
--   2. Update the `authenticator` role's own setting, which overrides the
--      config on the running server:
--        alter role authenticator set pgrst.db_schemas = '<full list incl. republic>';
--   3. Reload PostgREST:
--        notify pgrst, 'reload config';
--        notify pgrst, 'reload schema';
-- This migration file does not run those steps itself — they're project-
-- level config, not schema DDL, and are the orchestrator's responsibility to
-- apply alongside this file (per this task's instructions, this migration is
-- not applied to the remote project by this change).
