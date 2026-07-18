-- Event Radar — Apply Kit (roadmap phase 2 in EVENT_RADAR_PLAN.md).
-- Additive-only (root SCHEMA_RULES.md): new tables, nothing renamed/narrowed.
--
-- NOT YET APPLIED as of the commit that adds this file — the overnight session
-- that wrote it had no SUPABASE_ACCESS_TOKEN. Apply via the Management API
-- (POST /v1/projects/qcsyihymmaktkbqfxlkl/database/query) before testing
-- Apply Kit; the UI degrades to a "not provisioned" notice until then.

-- One reusable application profile per user: the "who am I" every hackathon
-- form asks for. A single jsonb document (name, school, links, skills, bio…)
-- instead of columns — the shape is owned and versioned by app code
-- (lib/apply-kit.ts), and evolving it never needs another migration.
create table hackathon.application_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  profile jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table hackathon.application_profiles enable row level security;

create policy "own application profile"
  on hackathon.application_profiles for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Drafted answers for one hackathon's application form. questions is the
-- pasted list (array of strings), answers the drafted [{question, answer}]
-- pairs; model records which LLM drafted them.
create table hackathon.application_drafts (
  user_id uuid not null references auth.users on delete cascade,
  hackathon_id uuid not null references hackathon.hackathons on delete cascade,
  questions jsonb not null default '[]',
  answers jsonb not null default '[]',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, hackathon_id)
);

alter table hackathon.application_drafts enable row level security;

create policy "own application drafts"
  on hackathon.application_drafts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 0001's default privileges already cover tables created later by the same
-- role, but explicit grants keep this migration self-contained either way.
grant all on hackathon.application_profiles to anon, authenticated, service_role;
grant all on hackathon.application_drafts to anon, authenticated, service_role;

-- Make PostgREST pick up the new tables immediately.
notify pgrst, 'reload schema';
