# Schema rules — hub repo

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

Users running older deployed versions of any app must always be able to read AND write data created by newer versions, indefinitely. The portfolio runs three live versions per app (`stable`, `previous`, `main`) plus whatever each user has pinned. If you drop or rename a column, the older versions break.

This rule applies for the **entire lifetime of the project**. There's no migration window. Treat every schema change as forever.

## What to do when you wish you could rename / drop

- **Rename:** add the new column, dual-write from app code until older versions retire, leave the old column in place forever.
- **Drop:** stop writing to it from app code, leave the column in place. It costs almost nothing.
- **Narrow a type:** don't. If app code needs a stricter shape, validate in code.

## Migrations

SQL lives in `supabase/sql/`. Numbered files (`0001_…`, `0002_…`). Each file is a one-time-apply script. The plan is to wire up [Supabase GitHub integration](https://supabase.com/docs/guides/local-development/database-migrations#github-actions) eventually so these auto-deploy, but for now: paste the file's contents into the SQL editor in the dashboard and run.

Before opening any migration: re-read this file.
