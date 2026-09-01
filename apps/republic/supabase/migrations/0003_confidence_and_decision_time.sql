-- Additive-only (SCHEMA_RULES.md): two new nullable columns on
-- republic.applications for the DATE-path features.
--   declared_confidence — raw self-declared confidence (the passport prints
--                         it 15% lower, "adjusted by officer")
--   decision_seconds    — how long the applicant stared at /visa before
--                         choosing (recorded only for the DATE path)
alter table republic.applications
  add column if not exists declared_confidence integer;
alter table republic.applications
  add column if not exists decision_seconds numeric;
