# Lock In — app context (`apps/lock-in`)

> Read the repo-root `CLAUDE.md` and `SCHEMA_RULES.md` first — they govern every app.
> **Keep `Current state` and `Next` (bottom) up to date — update them after every change to this app.**

Tasks, prioritised. Voice in, lock in. PWA companion to Focus Gate — the gate's "Lock in"
button lands here. Pure-black theme with a gold accent.

## Stack
- Next.js 15 (App Router, `next 15.5.18`) + React 19 + TypeScript
- Tailwind 3 (black + gold), Tabler icons (`@tabler/icons-react`)
- Supabase SSR (`@supabase/ssr`) — Google OAuth, shared `focus_gate` schema
- Web Speech API for mic input
- ESLint flat config (`eslint.config.mjs`), `next.config.ts` (empty), PWA (`public/sw.js`)
- Prod: `icefrosst-lock-in.vercel.app` (Vercel project `icefrosst-lock-in`, Root Directory `apps/lock-in`)

## Conventions
- App code in `app/` (no `src/`); components in `components/` (`AddTaskBar`, `TaskRow`, `LockInLogo`, `ServiceWorkerRegistrar`); `@/*` → app root.
- Supabase clients in `lib/supabase/`; `middleware.ts` only refreshes the session.
- Priority type + ordering live in `lib/types.ts` (`Priority`, `PRIORITY_RANK`); sort high → low. Rows from Supabase pass through `normalizeTask` (`priority ?? 'medium'` — the column is nullable) so the rest of the app treats `priority` as non-null.
- One priority palette: the `priority-*` Tailwind colors (Radix-matching) — there is no second `prio-*` scale.

## Data model
- **Shares** `focus_gate.tasks` with Focus Gate (Focus Gate owns/creates it). Lock In **added** `priority text` (`'low'|'medium'|'high'`, default `'medium'`) and `due_date date` — `supabase/migrations/0001_tasks_priority_due_date.sql`.
- `supabase/migrations/0002_grant_focus_gate_api_access.sql` exposes the `focus_gate` schema to PostgREST (grants + exposed-schema list) so both apps can read the table over the API; `0003_narrow_grants.sql` revokes `anon` table/sequence access again (every app gates behind sign-in — defense-in-depth on top of RLS).
- Additive-only (`SCHEMA_RULES.md`); RLS by `user_id`.

## Gotchas
- Same shared table as Focus Gate — a column you stop using may still be required there. **Never drop/rename.**
- Mutations should optimistic-update **and roll back on error** (see delete/restore in `app/page.tsx` and `app/archive/page.tsx`) — surface failures, don't swallow them.
- Web Speech API support varies by browser; always keep the typed-input path working.

## Current state
Live and working: add tasks (text + voice), priorities, due dates, complete/delete, and an
archive view (`app/archive/page.tsx`). Deployed from `main`. Audit fixes in: the auth
callback sanitizes `next` (path-only redirect target); both pages surface fetch failures
via their error line instead of rendering an empty list; mic errors show a one-line hint
(blocked permissions / no speech); priority accents use the single `priority-*` palette;
rows are `select-none` + `-webkit-touch-callout: none` so long-press only opens the sheet;
the SW (`lock-in-v2`) caches only ok same-origin GETs, skips `/auth/`, cleans old caches on
activate, and is registered from the layout via `ServiceWorkerRegistrar` (works from any
entry route, e.g. `/archive`).

## Next
- _Nothing queued yet — add items here as they come up._
