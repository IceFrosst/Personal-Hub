# Schema Rules — Lock In

Lock In reads/writes the same table as Focus Gate: **`focus_gate.tasks`**.

Iron rule (from CLAUDE.md): **schema is additive forever.**

## `focus_gate.tasks` (shared with Focus Gate)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK auth.users NOT NULL | RLS anchor |
| title | text NOT NULL | |
| is_quick | boolean DEFAULT false | legacy (Focus Gate) |
| is_completed | boolean DEFAULT false | |
| created_at | timestamptz DEFAULT now() | |
| last_suggested_at | timestamptz | nullable |
| suggestion_count | integer DEFAULT 0 | |
| priority | text DEFAULT 'medium' CHECK (low/medium/high) | added in 0001 |
| due_date | date | nullable; indexed |

## Rules

- Never rename, drop, or narrow a column
- New columns must have DEFAULT values or be nullable
- RLS must stay enabled — never disable
- Focus Gate writes must keep working (don't require new columns on insert)
