-- Lock In · Game Plan: AI day-scheduling that reads the task list and writes
-- time blocks to Google Calendar.
--
-- This introduces Lock In's OWN Postgres schema, `lock_in` (iron rule #3: one
-- Supabase project, namespaced per app). focus_gate.tasks is left untouched.
-- Additive-only forever (SCHEMA_RULES.md); RLS by user_id on every table.
--
-- After applying, `lock_in` must also be added to PostgREST's exposed-schema
-- list (Supabase project config: db_schema = '...,focus_gate,lock_in') so the
-- app can read plan_blocks / plan_settings over the API. Done via the
-- Management API alongside this migration.

create schema if not exists lock_in;

-- One Google Calendar connection per user. Holds the offline refresh token the
-- unattended cron uses to mint fresh access tokens while the user is away.
-- RLS restricts every row to its owner; the cron reads it with the service_role
-- key (which bypasses RLS) — never the browser anon key for other users.
create table if not exists lock_in.calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_refresh_token text not null,
  google_email text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table lock_in.calendar_connections enable row level security;

drop policy if exists "own connection" on lock_in.calendar_connections;
create policy "own connection" on lock_in.calendar_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Per-user planning preferences. A row is created lazily on first visit.
create table if not exists lock_in.plan_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  work_start text not null default '09:00',   -- local wall-clock HH:MM
  work_end text not null default '18:00',
  timezone text not null default 'Europe/Vilnius',
  auto_plan boolean not null default true,     -- include in the morning cron
  updated_at timestamptz not null default now()
);

alter table lock_in.plan_settings enable row level security;

drop policy if exists "own settings" on lock_in.plan_settings;
create policy "own settings" on lock_in.plan_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The plan itself: one row per scheduled block for a given day. Times are stored
-- as local wall-clock strings + the timezone they belong to, so the timeline
-- renders without any offset math and Google gets (dateTime, timeZone) directly.
-- title is denormalised so the timeline reads without joining focus_gate.tasks.
create table if not exists lock_in.plan_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid,                       -- focus_gate.tasks.id; nullable (task may be deleted)
  title text not null,
  plan_date date not null,
  start_local text not null,          -- 'HH:MM'
  end_local text not null,            -- 'HH:MM'
  timezone text not null,
  estimated_minutes integer,
  gcal_event_id text,                 -- Google Calendar event id, if written
  status text not null default 'scheduled'
    check (status in ('scheduled', 'done', 'skipped')),
  created_at timestamptz not null default now()
);

alter table lock_in.plan_blocks enable row level security;

drop policy if exists "own blocks" on lock_in.plan_blocks;
create policy "own blocks" on lock_in.plan_blocks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists plan_blocks_user_date_idx
  on lock_in.plan_blocks (user_id, plan_date);

-- Expose the schema + tables to the PostgREST API (RLS still gates every row).
grant usage on schema lock_in to anon, authenticated, service_role;

grant all on all tables in schema lock_in
  to anon, authenticated, service_role;

grant all on all sequences in schema lock_in
  to anon, authenticated, service_role;

alter default privileges in schema lock_in
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema lock_in
  grant all on sequences to anon, authenticated, service_role;
