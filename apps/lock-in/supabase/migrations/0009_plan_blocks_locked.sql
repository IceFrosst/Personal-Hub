-- Lock In · Game Plan: mark a block as locked. Locked blocks are the user's
-- existing calendar events, shown in the timeline as immovable anchors that the
-- draggable task/routine blocks reflow around. Additive-only.

alter table lock_in.plan_blocks
  add column if not exists locked boolean not null default false;
