-- "Continue tomorrow": a task you worked on today but will finish another day.
--
-- 1. focus_gate.tasks.snoozed_until — the task stays open but is EXCLUDED from
--    Game Plan scheduling for days before this date. Continuing a task sets it
--    to the next day, so today's replans don't re-add it while tomorrow's plan
--    picks it up. Additive + nullable (null = never snoozed, old rows fine).
alter table focus_gate.tasks add column if not exists snoozed_until date;

-- 2. Widen plan_blocks.status with 'continued' — today's block stays on the
--    timeline as progress ("worked on, continues tomorrow"). Widening the CHECK
--    is additive: every previously-valid value stays valid.
alter table lock_in.plan_blocks drop constraint if exists plan_blocks_status_check;
alter table lock_in.plan_blocks add constraint plan_blocks_status_check
  check (status in ('scheduled', 'done', 'skipped', 'continued'));
