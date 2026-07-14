-- Lock In · Recurring tasks. A recurring task is a TEMPLATE (title + which
-- weekdays + duration + fixed/flexible time). Each day it's due it shows in the
-- list; checking it off writes a completion row for that date and it returns on
-- its next due day. Templates are never deleted by a check-off.
--
-- lock_in schema (additive; focus_gate.tasks untouched). RLS by user_id.

create table if not exists lock_in.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  -- ISO weekdays the task recurs on: 1=Mon … 7=Sun. Every day = {1,2,3,4,5,6,7}.
  weekdays smallint[] not null,
  time_mode text not null default 'flexible'
    check (time_mode in ('fixed', 'flexible')),
  fixed_time text,             -- 'HH:MM' local, only meaningful when time_mode='fixed'
  duration_minutes integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table lock_in.recurring_tasks enable row level security;

drop policy if exists "own recurring" on lock_in.recurring_tasks;
create policy "own recurring" on lock_in.recurring_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recurring_tasks_user_active_idx
  on lock_in.recurring_tasks (user_id)
  where is_active;

create table if not exists lock_in.recurring_completions (
  id uuid primary key default gen_random_uuid(),
  recurring_id uuid not null references lock_in.recurring_tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed_date date not null,
  completed_at timestamptz not null default now(),
  unique (recurring_id, completed_date)
);

alter table lock_in.recurring_completions enable row level security;

drop policy if exists "own completions" on lock_in.recurring_completions;
create policy "own completions" on lock_in.recurring_completions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recurring_completions_user_date_idx
  on lock_in.recurring_completions (user_id, completed_date);

-- Grants (RLS still gates every row).
grant all on lock_in.recurring_tasks to anon, authenticated, service_role;
grant all on lock_in.recurring_completions to anon, authenticated, service_role;

-- Retire the temporary OAuth diagnostic table.
drop table if exists lock_in.oauth_debug;
