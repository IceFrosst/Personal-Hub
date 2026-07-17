-- Event Radar v1 — hackathon schema (locked in EVENT_RADAR_PLAN.md).
-- Additive-only forever (root SCHEMA_RULES.md).

create schema if not exists hackathon;

-- Global catalog. Written only by the ingest cron via the service role: RLS is
-- enabled with a select-only policy, so authenticated/anon writes are refused
-- even though PostgREST grants exist (grants unlock the API, RLS gates rows).
create table hackathon.hackathons (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text,
  title text not null,
  url text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  registration_deadline timestamptz,
  format text,
  city text,
  country text,
  location_raw text,
  prize_pool text,
  travel_covered boolean,
  accommodation_covered boolean,
  open_to_business_students boolean,
  themes jsonb not null default '[]',
  raw_description text,
  enriched_at timestamptz,
  notified_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, url)
);

alter table hackathon.hackathons enable row level security;

create policy "hackathons readable by signed-in users"
  on hackathon.hackathons for select
  to authenticated
  using (true);

create index hackathons_registration_deadline_idx
  on hackathon.hackathons (registration_deadline);
create index hackathons_unenriched_idx
  on hackathon.hackathons (created_at) where enriched_at is null;
create index hackathons_unnotified_idx
  on hackathon.hackathons (created_at) where notified_at is null;

create table hackathon.user_hackathon_status (
  user_id uuid not null references auth.users on delete cascade,
  hackathon_id uuid not null references hackathon.hackathons on delete cascade,
  status text not null check (status in ('interested', 'applying', 'applied', 'hidden')),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (user_id, hackathon_id)
);

alter table hackathon.user_hackathon_status enable row level security;

create policy "own status rows"
  on hackathon.user_hackathon_status for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table hackathon.user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  filters jsonb not null default '{}',
  notification_settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table hackathon.user_preferences enable row level security;

create policy "own preferences"
  on hackathon.user_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table hackathon.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table hackathon.push_subscriptions enable row level security;

create policy "own push subscriptions"
  on hackathon.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Expose the schema to PostgREST (mirrors lock-in's 0002 grant migration).
-- The schema must ALSO be appended to the project's exposed-schema list
-- (db_schema = 'public,graphql_public,hub,focus_gate,cookie_jar,lock_in,hackathon').
grant usage on schema hackathon to anon, authenticated, service_role;
grant all on all tables in schema hackathon to anon, authenticated, service_role;
grant all on all sequences in schema hackathon to anon, authenticated, service_role;
alter default privileges in schema hackathon
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema hackathon
  grant all on sequences to anon, authenticated, service_role;
