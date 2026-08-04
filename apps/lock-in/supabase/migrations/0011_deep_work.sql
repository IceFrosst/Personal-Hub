-- Deep Work sessions: the planner reserves 1-2 long focus blocks a day instead
-- of time-boxing every task. Tasks are assigned into a session by hand.
-- Additive only (SCHEMA_RULES.md): new column + new table + new settings.

-- 'deep_work' marks a reserved focus block. Existing rows stay null and behave
-- exactly as before (a task block, a routine block, or a locked calendar event).
alter table lock_in.plan_blocks add column if not exists kind text;

-- Which tasks the user put in a session. No times — a session is a container.
create table if not exists lock_in.deep_work_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  block_id uuid not null references lock_in.plan_blocks(id) on delete cascade,
  task_id uuid not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (block_id, task_id)
);

create index if not exists deep_work_items_block_idx on lock_in.deep_work_items (block_id);
create index if not exists deep_work_items_user_idx on lock_in.deep_work_items (user_id);

alter table lock_in.deep_work_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'lock_in' and tablename = 'deep_work_items'
      and policyname = 'deep_work_items_own_rows'
  ) then
    create policy deep_work_items_own_rows on lock_in.deep_work_items
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

grant usage on schema lock_in to anon, authenticated;
grant all on lock_in.deep_work_items to anon, authenticated;

-- How the planner reserves sessions.
alter table lock_in.plan_settings add column if not exists deep_work_count int not null default 2;
alter table lock_in.plan_settings add column if not exists deep_work_min_minutes int not null default 120;
alter table lock_in.plan_settings add column if not exists deep_work_max_minutes int not null default 240;
