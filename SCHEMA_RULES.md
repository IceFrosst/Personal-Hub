# Schema Rules — Focus Gate

Iron rule (from CLAUDE.md): **schema is additive forever.**

## `focus_gate.tasks`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK auth.users NOT NULL | RLS anchor |
| title | text NOT NULL | |
| is_quick | boolean DEFAULT false | |
| is_completed | boolean DEFAULT false | |
| created_at | timestamptz DEFAULT now() | |
| last_suggested_at | timestamptz | nullable |
| suggestion_count | integer DEFAULT 0 | |

## Rules

- Never rename, drop, or narrow a column
- New columns must have DEFAULT values or be nullable
- RLS must stay enabled — never disable
