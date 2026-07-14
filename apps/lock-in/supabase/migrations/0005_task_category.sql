-- Lock In: add a category/tag to one-off tasks on the shared focus_gate.tasks
-- table. Additive-only (SCHEMA_RULES.md); nullable so existing rows and Focus
-- Gate are unaffected.

alter table focus_gate.tasks
  add column if not exists category text
  check (category in ('work', 'hustle', 'social', 'other'));
