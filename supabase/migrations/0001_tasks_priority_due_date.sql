-- Lock In: add priority and due_date columns to the shared focus_gate.tasks table.
-- Iron rule: schema is additive forever. This migration is idempotent.
-- Already applied to project qcsyihymmaktkbqfxlkl on 2026-05-28.

alter table focus_gate.tasks
  add column if not exists priority text default 'medium'
  check (priority in ('low','medium','high'));

alter table focus_gate.tasks
  add column if not exists due_date date;

create index if not exists tasks_due_date_idx
  on focus_gate.tasks (due_date)
  where due_date is not null;
