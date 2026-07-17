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
- App code in `app/` (no `src/`); components in `components/` (`AddTaskBar`, `TaskRow`, `RecurringRow`, `LockInLogo`); `@/*` → app root.
- Supabase clients in `lib/supabase/`; `middleware.ts` only refreshes the session.
- Priority type + ordering live in `lib/types.ts` (`Priority`, `PRIORITY_RANK`); sort high → low.
- Recurring-task types (`RecurringTask`, `RecurringCompletion`, `TimeMode`, weekday helpers) in `lib/types.ts`; recurrence date logic (ISO weekday, streaks, due-today) in `lib/recurring.ts`.

## Data model
- **Shares** `focus_gate.tasks` with Focus Gate (Focus Gate owns/creates it). Lock In **added** `priority text` (`'low'|'medium'|'high'`, default `'medium'`) and `due_date date` (`0001`), and `category text` (`'work'|'hustle'|'social'|'other'`, nullable — the one-off task tag; `0005_task_category.sql`).
- `supabase/migrations/0002_grant_focus_gate_api_access.sql` exposes the `focus_gate` schema to PostgREST (grants + exposed-schema list) so both apps can read the table over the API.
- **`lock_in` schema (Lock In's own)** — `supabase/migrations/0003_game_plan.sql`, exposed to PostgREST (`db_schema` now includes `lock_in`). Three tables, all RLS by `user_id`:
  - `calendar_connections (user_id pk, google_refresh_token, google_email, connected_at, updated_at)` — the Google offline refresh token for Game Plan. The cron reads it with the **service_role** key; the browser only ever selects the non-token columns.
  - `plan_settings (user_id pk, work_start, work_end, timezone, auto_plan, updated_at)` — planning prefs; created lazily.
  - `plan_blocks (id, user_id, task_id, title, plan_date, start_local, end_local, timezone, estimated_minutes, gcal_event_id, status)` — the scheduled day. Times are **local wall-clock strings + timezone** (no offset math; Google gets `dateTime`+`timeZone` directly). `title` denormalised so the timeline renders without joining tasks.
- **Recurring tasks** — `supabase/migrations/0004_recurring_tasks.sql`, `lock_in` schema, RLS by `user_id`:
  - `recurring_tasks (id, user_id, title, weekdays smallint[] /* ISO 1=Mon…7=Sun */, time_mode 'fixed'|'flexible', fixed_time, duration_minutes, is_active, created_at)` — a **template**, not a per-day row. No priority (routines aren't triaged).
  - `recurring_completions (id, recurring_id, user_id, completed_date, completed_at)`, unique `(recurring_id, completed_date)` — one row per day a routine is checked off. Streaks derive from these; the template is never deleted by a check-off.
- Additive-only (`SCHEMA_RULES.md`); RLS by `user_id`. (`0004` also drops the temporary `oauth_debug` diagnostic table.)

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

The planner (`lib/game-plan/planner.ts`) runs in **four phases so routines always win a slot before
one-off tasks**: (1) **fixed-time routines** pinned to their clock time (slide to nearest free slot
if busy); (2) **flexible routines reserved next, before any task, longest first** — so a big routine
(e.g. a 2 h workout) is guaranteed room and can't be crowded out by smaller tasks; (3) **one-off
tasks** fill the *remaining* free time (Gemini estimates durations; deterministic packer fallback);
(4) an **AI reorder pass** (`geminiOrder` → `reflowByOrder`) reorders the whole movable day (flex
routines + tasks) into a logical flow around the fixed anchors — best-effort, only when phase-3's
model call worked; on failure the phase 1–3 layout stands. Day-shape strategy applied throughout:
quick win first (**only on a fresh start-of-day / future-day plan** — a mid-day replan skips the
quick-win opener since the day's already underway; gated on `earliestStart <= work_start`) · protect
deep-work blocks · end on a high · meals after exercise · breaks after hard work · **tag-aware** (work/hustle in peak
hours, social/other later; group same-tag). `run.ts` loads routines due for the target date
(skipping ones completed that day). One-off durations are Gemini-estimated from the title; routine
durations are exact. **Replanning freezes the past and cuts at now:** on today, the cutoff is now
(rounded to the 5-min grid, never before `work_start`). `run.ts` keeps every block that started
before the cutoff — a block wholly in the past stays as-is; the block you're in / just finished
(which runs past the cutoff) is **truncated to end at the cutoff** (its row + calendar event patched),
so a task finished at 13:20 reads 13:00–13:20. New work starts at the cutoff, flush against it. Each
kept block's task/routine is dropped from the replan pool, so a finished item never reappears later
in the day. (Future days replan in full.) `sanitize()` now
**repairs** a mis-placed model block (shifts it to the nearest free slot) instead of dropping it;
the prompt may **split** tasks >90 min into two sessions (same id); and the deterministic fallback
applies the day-shape strategy too (quick win first · heavy work early · light item last).
Model: `process.env.GEMINI_MODEL || 'gemini-flash-latest'` (rolling free alias;
pinned names lose free quota). **`gemini-2.5-pro` has no free tier — it 429s on every call**, so it's
opt-in via `GEMINI_MODEL`, not the default. `planDay` returns an `ai` status (`ok` / `fallback` /
`rate_limited`); the client shows a note when the model didn't actually plan (this is the safety net
for silent model-death). Blocks are coloured by **priority** (`plan_blocks.priority`, `0008`;
prio-low/medium/high like the task list); **recurring blocks are white**. Timeline uses the same
square checkbox as `TaskRow`/`RecurringRow` (gold for tasks, white for routines).

**Timeline is interactive:** tap a block's checkbox to mark it done → the underlying task is completed
(`focus_gate.tasks.is_completed`) or the routine checked (`recurring_completions` for that date),
and `plan_blocks.status` flips — plan and list stay in sync. **Locked (calendar) blocks can also be
checked off** now, but it's **cosmetic only** (just `plan_blocks.status` — they have no task/routine
to complete, and the status resets on the next replan since locked blocks are re-read from the
calendar). **Today / Tomorrow** toggle plans and
views either day (route takes `day`; `run.ts` takes `targetDate` — future days use the full work
window, today starts from now). Blocks show a repeat glyph for routines and a tag-colored left
border + chip (`plan_blocks.category` denormalised, `0007`; `recurring_id` link, `0006`).

**The user's real calendar events are shown as locked blocks** (`plan_blocks.locked`, `0009`;
`listDayEvents` reads real timed events excluding our tagged ones — `run.ts` now cleans up *before*
reading so old GP events aren't re-read). Locked blocks show a small lock glyph, aren't draggable
or editable, and no calendar event is written for them (they already exist) — but they **can** be
checked off (cosmetic, see above). Rows have **no left time gutter** (the
start–end time lives in the card's meta line). **Press-and-hold anywhere on a movable block to pick
it up** (`Timeline`: a ~300 ms long-press arms the drag from any position; a pre-arm finger move
>10 px is treated as a page scroll and lets go). Once armed, drag to reorder (neighbour-swap, follows
the finger; a non-passive `touchmove` listener blocks page scroll while held); on drop, `POST
/api/game-plan/reorder` reflows the movable blocks around the locked ones (never overlapping), updates
`plan_blocks` start/end, and `patchEvent`s each moved calendar event. **Reflow is bounded by
`work_end`:** a block that would land past the end of the working day (an overbooked day) is dropped
(row + calendar event deleted) rather than cascading past midnight into invalid `24:00+` times; the
route returns `droppedCount` and the client shows a note. Each movable block has a
**pencil button on the right** that opens an action sheet (Edit / Delete), same as the task list.
**Edit** reuses `EditTaskSheet` / `EditRecurringSheet` (fetching the full task/routine
row); saving writes the task/routine **and** mirrors the denormalised fields (title, priority,
category) onto its `plan_blocks` so the timeline and list stay in lockstep — and editing a task in
the **list** likewise syncs its blocks (`page.tsx` `updateTask`/`updateRecurring`). Changing a
routine's **time or duration adjusts the existing block instantly** (no replan): `POST
/api/game-plan/adjust-routine` re-places its block(s) from today onward into the nearest free slot
around the day's other blocks (fixed → its clock time, flexible → keeps its start; both take the new
duration) and `patchEvent`s the calendar event. **Remove from plan** deletes only *that* block
(`POST /api/game-plan/cleanup-blocks` with `blockId`) + its calendar event — the underlying
task/routine **stays on the list**, so a replan can re-add it. (Deleting the task/routine outright is
done from the **list**, which calls the same route with `taskId`/`recurringId` to drop all its blocks
from today onward + their calendar events — durable token, so the list's delete, which has no
`provider_token`, cleans up too.)

Provisioned by this session: `GEMINI_API_KEY` and `CRON_SECRET` are set on the `icefrosst-lock-in`
Vercel project. Calendar connect is **live and working** (schema exposure + token capture fixed);
the **on-demand button works now** (via the live-session token, ~1h window).

**Recurring tasks** — the add-task bar has a loop toggle (`AddTaskBar`); on, it swaps priority+date
for row 1 (Flexible/Fixed time-mode · typed **h/m duration** inputs · when Fixed, a time chip that
opens a centered **`TimeWheel`** popup — vertical scroll wheel for hour/minute) and row 2
(Every day / Custom → weekday chips when Custom). Routines render **below** one-off tasks with a
**white** accent (`RecurringRow`) and a streak; checking one writes a `recurring_completions` row
for today and it returns next due day. Long-press → delete routine. **Fixed** = pinned clock time
(Game Plan will slide to the nearest free slot if busy); **Flexible** = Game Plan auto-places it.

**Tags** — one-off tasks have a Tag button (`AddTaskBar`, non-recurring) opening a category popup
(Work/Hustle/Social/Other, inline hex colors from `TASK_CATEGORIES`); shown as a colored chip on
`TaskRow` and editable in `EditTaskSheet` (long-press → Edit). Selected toggle buttons across the
add bar are gold (priority, Every day/Custom, weekday chips, loop); time-mode/duration stay neutral.

## Next
- **Open (needs the user's call — don't just change defaults):**
  - **Planning window vs. evening routines.** Default is `09:00–18:00` (`DEFAULT_SETTINGS` in
    `lib/game-plan/types.ts`), but the user schedules evening routines (~20:00–22:00). Discuss:
    raise default `work_end`, rename "work hours" → "planning window", or let fixed routines sit
    outside the window. **Ask before changing.**
  - **Duplicate routine names:** user has two routines both named "Prediction markets + X" (fixed
    09:00 + fixed 20:00). Not a bug; suggest renaming one — user's call.
- **Duration learning:** one-off task durations are Gemini-guessed from the title. Later, learn from
  actuals (planned vs. real) and/or let a one-off task carry a user-set duration.
- **Settings depth:** per-weekday work hours; a timezone picker (currently the `plan_settings`
  default `Europe/Vilnius`).
- **Surface AI-vs-fallback:** the plan silently uses the deterministic packer when Gemini fails
  (how the dead-model bug hid). Consider returning an `ai` flag and a subtle "basic estimates" note.
- **Block-start notifications** (web push) — real nudge value, meaningful PWA push setup cost.
- **Provisioning is DONE:** the three secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`) are set on `icefrosst-lock-in` (Production), so the morning cron +
  durable planning are live. Google Cloud console done (Calendar API, scope, published).
