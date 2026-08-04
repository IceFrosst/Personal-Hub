-- Some routines are non-negotiable: lunch and dinner have to appear on EVERY
-- day, even when the day is packed. A mandatory routine is placed before the
-- planner reserves focus sessions, and is never dropped for lack of room —
-- it widens its search past the working window rather than skip a day.
-- Additive only (SCHEMA_RULES.md).
alter table lock_in.recurring_tasks
  add column if not exists is_mandatory boolean not null default false;
