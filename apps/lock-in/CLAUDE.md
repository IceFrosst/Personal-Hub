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
- App code in `app/` (no `src/`); components in `components/` (`AddTaskBar`, `TaskRow`, `LockInLogo`); `@/*` → app root.
- Supabase clients in `lib/supabase/`; `middleware.ts` only refreshes the session.
- Priority type + ordering live in `lib/types.ts` (`Priority`, `PRIORITY_RANK`); sort high → low.

## Data model
- **Shares** `focus_gate.tasks` with Focus Gate (Focus Gate owns/creates it). Lock In **added** `priority text` (`'low'|'medium'|'high'`, default `'medium'`) and `due_date date` — `supabase/migrations/0001_tasks_priority_due_date.sql`.
- `supabase/migrations/0002_grant_focus_gate_api_access.sql` exposes the `focus_gate` schema to PostgREST (grants + exposed-schema list) so both apps can read the table over the API.
- **`lock_in` schema (Lock In's own)** — `supabase/migrations/0003_game_plan.sql`, exposed to PostgREST (`db_schema` now includes `lock_in`). Three tables, all RLS by `user_id`:
  - `calendar_connections (user_id pk, google_refresh_token, google_email, connected_at, updated_at)` — the Google offline refresh token for Game Plan. The cron reads it with the **service_role** key; the browser only ever selects the non-token columns.
  - `plan_settings (user_id pk, work_start, work_end, timezone, auto_plan, updated_at)` — planning prefs; created lazily.
  - `plan_blocks (id, user_id, task_id, title, plan_date, start_local, end_local, timezone, estimated_minutes, gcal_event_id, status)` — the scheduled day. Times are **local wall-clock strings + timezone** (no offset math; Google gets `dateTime`+`timeZone` directly). `title` denormalised so the timeline renders without joining tasks.
- Additive-only (`SCHEMA_RULES.md`); RLS by `user_id`.

## Gotchas
- Same shared table as Focus Gate — a column you stop using may still be required there. **Never drop/rename.**
- Mutations should optimistic-update **and roll back on error** (see `TaskRow` delete/restore) — surface failures, don't swallow them.
- Web Speech API support varies by browser; always keep the typed-input path working.
- **Game Plan token flow:** `provider_refresh_token` is only present on the *initial* OAuth code exchange with `access_type=offline` + `prompt=consent`. `app/auth/callback/route.ts` captures it when the connect flow passes `?connect=1`. Supabase does **not** refresh Google provider tokens for you — the cron mints fresh access tokens itself from the stored refresh token (`lib/google/calendar.ts`), which needs `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` (the same client configured in Supabase's Google provider).
- **Two token paths** in `app/api/game-plan/plan/route.ts`: durable (stored refresh token + Google client secret) and a fallback that uses the browser session's live `provider_token` (works ~1h after connecting, before the OAuth secrets are set). The cron only has the durable path.
- **Never import `lib/supabase/admin.ts` into client code** — it's the service_role client (bypasses RLS), for the cron only.
- The cron (`app/api/cron/plan-day`, scheduled in `vercel.json`) returns **503** until `SUPABASE_SERVICE_ROLE_KEY` and the Google OAuth secrets are set — by design, so the on-demand button still works meanwhile.
- Planner (`lib/game-plan/planner.ts`) always has a deterministic fallback if Gemini is unavailable — the day still gets planned. `sanitize()` drops any model block that overlaps a busy interval / another block / the window.

## Current state
Live and working: add tasks (text + voice), priorities, due dates, complete/delete, and an
archive view (`app/archive/page.tsx`). Deployed from `main`.

**Game Plan** (`/game-plan`, linked from the home header) — AI day-scheduler over the task list.
Connect Google Calendar → "Plan my day" reads open tasks + today's calendar, Gemini estimates
durations and time-blocks a realistic day around existing events, and the blocks are written as
real calendar events + shown as an in-app timeline. Work-hours + auto-plan toggle in settings.
A daily Vercel cron (`vercel.json`, 05:00 UTC) plans every connected user automatically.

Provisioned by this session: `GEMINI_API_KEY` and `CRON_SECRET` are set on the `icefrosst-lock-in`
Vercel project. The **on-demand button works now** (via the live-session token, ~1h window).

## Next
- **To turn on the unattended morning cron + durable on-demand planning, add to the
  `icefrosst-lock-in` Vercel project env** (all Production): `SUPABASE_SERVICE_ROLE_KEY`,
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (the last two are the Google client
  already configured in Supabase Auth → Google provider).
- **Google Cloud console (one-time, ~5 min):** enable the Google Calendar API for the project;
  add the `.../auth/calendar.events` scope to the OAuth consent screen; publish the app
  (Testing → In production) so calendar access doesn't expire every 7 days.
- Nice-to-haves: mark a block done from the timeline; drag/edit a block; per-task manual duration
  override; reflect completed blocks back onto the task.
