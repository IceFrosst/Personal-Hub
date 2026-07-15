-- Lock In · Game Plan: denormalise the source task's category onto the block so
-- the timeline can colour it without joining focus_gate.tasks. Nullable
-- (routines and untagged tasks leave it null). Additive-only.

alter table lock_in.plan_blocks
  add column if not exists category text;
