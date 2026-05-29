# Schema rules

Read `CLAUDE.md` first; this is the short version of iron rule #2.

## The rule

**Schema changes are ADDITIVE ONLY. Forever.**

You may:
- Add a new column to an existing table
- Add a new table
- Add a new JSON field inside an existing JSON column
- Add a new index, policy, trigger, function

You may NEVER:
- Drop a column
- Rename a column
- Drop a table
- Rename a table
- Narrow a type (e.g. `text` → `varchar(50)`, `bigint` → `int`)
- Change a default value in a way that mutates existing rows
- Tighten a `NOT NULL` constraint on an existing column without a default for prior rows

## Why

Users running older installed copies of any app (PWAs linger on phones) must always be able to read AND write data created by newer versions, indefinitely. Apps also **share tables** — Focus Gate and Lock In both use `focus_gate.tasks` — so a column one app stops using may still be required by another. If you drop or rename a column, something breaks.

This rule applies for the **entire lifetime of the project**. There's no migration window. Treat every schema change as forever.

## What to do when you wish you could rename / drop

- **Rename:** add the new column, dual-write from app code until older versions retire, leave the old column in place forever.
- **Drop:** stop writing to it from app code, leave the column in place. It costs almost nothing.
- **Narrow a type:** don't. If app code needs a stricter shape, validate in code.

## Migrations

SQL lives under each app — `apps/hub/supabase/sql/`, `apps/focus-gate/supabase/migrations/`, `apps/lock-in/supabase/migrations/`. Numbered files (`0001_…`, `0002_…`), each a one-time-apply script. For now: paste the file's contents into the Supabase SQL editor and run (or apply via the Management API). Consolidating these into one ordered `db/migrations/` is part of the pending structure pass.

Before opening any migration: re-read this file.
