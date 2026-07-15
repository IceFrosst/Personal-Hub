-- Lock In · Game Plan: denormalise the source task's priority onto the block so
-- the timeline can colour it like the task list (recurring blocks stay null →
-- rendered white). Additive-only.

alter table lock_in.plan_blocks
  add column if not exists priority text
  check (priority in ('low', 'medium', 'high'));
