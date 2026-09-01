-- Republic submission tables: applications, appointments, bribes.
--
-- DELIBERATE deviation from the portfolio's iron rule #4 (user_id + RLS
-- ownership): this app is an ANONYMOUS public funnel — visitors never sign
-- in, so there is no auth.uid() to own rows. Instead these tables are
-- WRITE-ONLY from the browser:
--   * RLS is enabled on every table.
--   * anon/authenticated get INSERT only (no SELECT/UPDATE/DELETE policies),
--     so nobody can read anyone's submissions through the public API.
--   * Ignas reads them via the Supabase dashboard / service role only.
-- Additive-only forever, per SCHEMA_RULES.md.
--
-- Client writes go through lib/api.ts#tryRest: unqualified table name +
-- `Content-Profile: republic` header, so the `republic` schema must be in
-- PostgREST's exposed schemas (Data API settings) for these to land.

create schema if not exists republic;

-- ---------------------------------------------------------------------------
-- applications — ONE row per completed funnel (lib/api.ts#recordApplication)
-- ---------------------------------------------------------------------------
create table if not exists republic.applications (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  applicant_name text not null,
  instagram_handle text not null,
  visa_type text not null,
  slot text not null,
  reference_code text not null,
  -- Sub-step content; only the field relevant to the chosen visa is set.
  -- `matter` belongs to the removed SEEK ADVICE PERMIT and is kept for
  -- forward-compat (additive-only), never populated by current clients.
  matter text,
  idea text,
  supplies jsonb,
  pitch text,
  statement text,
  otherness text,
  interview_answers jsonb,
  duty_free_items jsonb,
  screening_question text,
  screening_answer text,
  declared_iq integer,
  gender text,
  selfie_captured boolean not null default false,
  selfie_size_bytes integer
);

-- Reference codes are generated exactly once per completed application, so a
-- duplicate row is always a client retry — keep the log clean.
create unique index if not exists applications_reference_code_key
  on republic.applications (reference_code);

alter table republic.applications enable row level security;

drop policy if exists "anon can insert applications" on republic.applications;
create policy "anon can insert applications"
  on republic.applications for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- appointments — written alongside the application (lib/api.ts#recordAppointment)
-- ---------------------------------------------------------------------------
create table if not exists republic.appointments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visa_type text not null,
  slot text not null,
  reference_code text not null
);

alter table republic.appointments enable row level security;

drop policy if exists "anon can insert appointments" on republic.appointments;
create policy "anon can insert appointments"
  on republic.appointments for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- bribes — one row per attempted bribe (lib/api.ts#recordBribe)
-- ---------------------------------------------------------------------------
create table if not exists republic.bribes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  count integer not null default 1
);

alter table republic.bribes enable row level security;

drop policy if exists "anon can insert bribes" on republic.bribes;
create policy "anon can insert bribes"
  on republic.bribes for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Grants — RLS gates row access, but PostgREST also needs schema/table grants.
-- INSERT only; deliberately no SELECT/UPDATE/DELETE for anon/authenticated.
-- ---------------------------------------------------------------------------
grant usage on schema republic to anon, authenticated;
grant insert on republic.applications, republic.appointments, republic.bribes
  to anon, authenticated;

-- Identity columns draw from backing sequences, and INSERTing roles need
-- USAGE on those sequences too (table INSERT alone is not enough in a custom
-- schema). Grant it on exactly the three sequences these tables own — looked
-- up by column so the generated names never drift — and NOT on
-- republic.applicant_number_seq, which migration 0001 deliberately keeps
-- reachable only through its SECURITY DEFINER RPC.
do $$
declare
  t text;
  seq text;
begin
  foreach t in array array['applications', 'appointments', 'bribes'] loop
    seq := pg_get_serial_sequence('republic.' || t, 'id');
    if seq is null then
      raise exception 'missing identity sequence for republic.%', t;
    end if;
    execute format('grant usage on sequence %s to anon, authenticated', seq);
  end loop;
end $$;
