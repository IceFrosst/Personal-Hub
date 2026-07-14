-- Lock In · Game Plan: let a scheduled block point back at the recurring routine
-- it came from (nullable — one-off task blocks leave it null and use task_id).
-- Additive-only.

alter table lock_in.plan_blocks
  add column if not exists recurring_id uuid;
