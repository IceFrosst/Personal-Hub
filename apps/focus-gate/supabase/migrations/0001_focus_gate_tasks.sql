-- Focus Gate: tasks table
-- Run manually in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/qcsyihymmaktkbqfxlkl/sql/new

create schema if not exists focus_gate;

create table if not exists focus_gate.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  is_quick boolean default false,
  is_completed boolean default false,
  created_at timestamptz default now(),
  last_suggested_at timestamptz,
  suggestion_count integer default 0
);

alter table focus_gate.tasks enable row level security;

create policy "select own tasks"
  on focus_gate.tasks for select
  using (auth.uid() = user_id);

create policy "insert own tasks"
  on focus_gate.tasks for insert
  with check (auth.uid() = user_id);

create policy "update own tasks"
  on focus_gate.tasks for update
  using (auth.uid() = user_id);

create policy "delete own tasks"
  on focus_gate.tasks for delete
  using (auth.uid() = user_id);

create index if not exists tasks_user_id_idx on focus_gate.tasks (user_id);
