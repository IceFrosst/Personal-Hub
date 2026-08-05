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
- **Shares** `focus_gate.tasks` with Focus Gate (Focus Gate owns/creates it). Lock In **added** `priority text` (`'low'|'medium'|'high'`, default `'medium'`) and `due_date date` (`0001`), `category text` (`'work'|'hustle'|'social'|'other'`, nullable — the one-off task tag; `0005_task_category.sql`), and `snoozed_until date` (nullable — Game Plan skips the task on days before this date; set by "Continue tomorrow"; `0010_continue_tomorrow.sql`, which also widens `plan_blocks.status` with `'continued'`).
- `supabase/migrations/0002_grant_focus_gate_api_access.sql` exposes the `focus_gate` schema to PostgREST (grants + exposed-schema list) so both apps can read the table over the API.
- **`lock_in` schema (Lock In's own)** — `supabase/migrations/0003_game_plan.sql`, exposed to PostgREST (`db_schema` now includes `lock_in`). Three tables, all RLS by `user_id`:
  - `calendar_connections (user_id pk, google_refresh_token, google_email, connected_at, updated_at)` — the Google offline refresh token for Game Plan. The cron reads it with the **service_role** key; the browser only ever selects the non-token columns.
  - `plan_settings (user_id pk, work_start, work_end, timezone, auto_plan, deep_work_count, deep_work_min_minutes, deep_work_max_minutes, updated_at)` — planning prefs; created lazily. (`0011` added the three `deep_work_*` columns: how many focus sessions to reserve and their length range.)
  - `plan_blocks (id, user_id, task_id, title, plan_date, start_local, end_local, timezone, estimated_minutes, gcal_event_id, status)` — the scheduled day. Times are **local wall-clock strings + timezone** (no offset math; Google gets `dateTime`+`timeZone` directly). `title` denormalised so the timeline renders without joining tasks.
- **Recurring tasks** — `supabase/migrations/0004_recurring_tasks.sql`, `lock_in` schema, RLS by `user_id`:
  - `recurring_tasks (id, user_id, title, weekdays smallint[] /* ISO 1=Mon…7=Sun */, time_mode 'fixed'|'flexible', fixed_time, duration_minutes, is_active, is_mandatory, created_at)` — a **template**, not a per-day row. No priority (routines aren't triaged). `is_mandatory` (`0012`) marks a routine that **must appear on every day it's due** — lunch and dinner are set this way.
  - `recurring_completions (id, recurring_id, user_id, completed_date, completed_at)`, unique `(recurring_id, completed_date)` — one row per day a routine is checked off. Streaks derive from these; the template is never deleted by a check-off.
- **Deep Work** — `supabase/migrations/0011_deep_work.sql`: `plan_blocks.kind text` (`'deep_work'` = a reserved focus session; **null on every pre-existing row**, which keeps behaving as a task / routine / locked block), plus `deep_work_items (id, user_id, block_id → plan_blocks on delete cascade, task_id, position)` unique `(block_id, task_id)`, RLS by `user_id` — which tasks the user put in a session. No times: a session is a container.
- Additive-only (`SCHEMA_RULES.md`); RLS by `user_id`. (`0004` also drops the temporary `oauth_debug` diagnostic table.)

## Gotchas
- Same shared table as Focus Gate — a column you stop using may still be required there. **Never drop/rename.**
- Mutations should optimistic-update **and roll back on error** (see `TaskRow` delete/restore) — surface failures, don't swallow them.
- Web Speech API support varies by browser; always keep the typed-input path working.
- **Game Plan token flow:** `provider_refresh_token` is only present on the *initial* OAuth code exchange with `access_type=offline` + `prompt=consent`. `app/auth/callback/route.ts` captures it when the connect flow passes `?connect=1`. Supabase does **not** refresh Google provider tokens for you — the cron mints fresh access tokens itself from the stored refresh token (`lib/google/calendar.ts`), which needs `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` (the same client configured in Supabase's Google provider).
- **Two token paths** in `app/api/game-plan/plan/route.ts`: durable (stored refresh token + Google client secret) and a fallback that uses the browser session's live `provider_token` (works ~1h after connecting, before the OAuth secrets are set). The cron only has the durable path.
- **Never import `lib/supabase/admin.ts` into client code** — it's the service_role client (bypasses RLS), for the cron only.
- The cron (`app/api/cron/plan-day`, scheduled in `vercel.json`) returns **503** until `SUPABASE_SERVICE_ROLE_KEY` and the Google OAuth secrets are set — by design, so the on-demand button still works meanwhile.
- **Planning is fully deterministic** (`lib/game-plan/planner.ts`) — no model call. Everything is placed against one running `occupied` list and `hasOverlap` exists to assert that invariant. If you reintroduce an AI pass, it must not be able to emit a block at coordinates the rest of the layout doesn't know about; that exact shape caused a live double-booking.
- **A Deep Work session's task list is not in `plan_blocks`** — it's `deep_work_items`, keyed by `block_id`. Replanning deletes and recreates the block rows, so anything that rebuilds a day must carry those lists over (see `run.ts`) or the user's hand-built session empties itself.

## Current state
Live and working: add tasks (text + voice), priorities, due dates, complete/delete, and an
archive view (`app/archive/page.tsx`). Deployed from `main`.

**Game Plan** (`/game-plan`, linked from the home header) — AI day-scheduler over the task list.
Connect Google Calendar → "Plan my day" reads open tasks + today's calendar, Gemini estimates
durations and time-blocks a realistic day around existing events, and the blocks are written as
real calendar events + shown as an in-app timeline. Work-hours + auto-plan toggle in settings.
A daily Vercel cron (`vercel.json`, 05:00 UTC) plans every connected user automatically.

**Add task from Game Plan** — the full `AddTaskBar` (one-off + recurring, voice, priority, due date,
tag) lives at the **bottom** of the Game Plan page (today/tomorrow only), below the planned day.
Creating a task or routine here writes to the same tables as the main list (`focus_gate.tasks` /
`lock_in.recurring_tasks`), so it appears in the real to-do list immediately.

**Adding a task drops it in the "Not scheduled" tray, not into the plan.** A task created on the
Game Plan tab is deliberately *not* placed (this replaced the old auto-fit-on-add — the two can't
coexist, an auto-placed task never reaches a tray). It appears as a chip under the day, and you
**drag it** (arms on touch-down): drop on a **Deep Work session** to put it inside
(`session-tasks`), or on the **day at the exact spot you release it** (`insert-at`): a gold
`DropLine` shows the slot (top/bottom half of a row decides before/after), the length is Gemini's
estimate from the title (`estimateTaskMinutes`), and the day is then **reflowed around it** so later
blocks slide to make room. Layout rules live in `lib/game-plan/reflow.ts` (`reflowDay`), shared with
drag-to-reorder so both behave identically. **Nothing is ever deleted to make room** — locked
calendar events never move, and everything else is allowed to run past `work_end` (the user's
explicit call: an overrunning day is theirs to look at, not ours to silently delete work from).
Packing is bounded only by 23:59, because times are `HH:MM` within one `plan_date` and can't express
past-midnight; a block that would cross it is *shortened* to end at 23:59 rather than dropped.
`overflowCount` reports how many ran over.
The tray holds **only tasks created right here that haven't been placed yet** — it is deliberately
*not* backfilled from the database. It's the tail end of "I just added this", not a second copy of
the task list, so it's empty on load and empties itself as you place things. Drop zones are declarative `data-drop` markers (`day`, `session:<id>`)
hit-tested with `elementFromPoint`; a `pointer-events:none` ghost follows the finger.
**Touch gotcha (this broke it once):** a drag source must set `touch-action: none` (`touch-none`) or
the browser claims the gesture for scrolling and fires `pointercancel`, killing the drag — and don't
gate arming behind a hold timer that any finger jitter can cancel. The tray chips are `touch-none`
and arm on pointer-down; inside a session the drag lives on the **grip handle** (only the handle is
`touch-none`) so a long list still scrolls.

**`insert-task`** (the drag-onto-the-day path) — a *non-destructive* insert that places just that
task **without moving anything already there** (no full replan). `POST /api/game-plan/insert-task` →
`insertTaskIntoPlan` (`lib/game-plan/insert.ts`): busy = the day's existing `plan_blocks` (planned +
locked) **plus** a fresh `listDayEvents` read (covers a never-planned day); duration is
`estimateTaskMinutes` (Gemini from the title, `planner.ts`; priority default fallback). It places the
task in the **earliest free gap** after now inside the work window; if nothing fits, it **appends
after the last block — even a little past `work_end`** (returns `pastHours` so the client notes it).
Writes one calendar event + one `plan_blocks` row; existing blocks/events are untouched. Guards:
missing/completed task → no-op; task already in the day → no duplicate. (Full **Replan** still rebuilds
the whole day; **Fit it in** is the keep-everything alternative.)

**Deep Work sessions (the core of the planner).** The day is built around **1–2 long focus
blocks** instead of time-boxing every task. `planDay` (`lib/game-plan/planner.ts`) runs four
deterministic phases against one running `occupied` list, so the output **cannot** double-book:
1. **Fixed-time routines** pinned to their clock time (nearest free slot if busy).
   **Mandatory routines are never dropped.** Normal routines are skipped when nothing fits
   (`slotFor` returns null); a mandatory one widens its search past the working window instead —
   **forward first**, so a squeezed lunch runs late rather than landing at 08:15 before the day
   starts. Lunch/dinner have to exist every day, so they're flagged `is_mandatory`.
2. **Flexible routines**, in this order: **meals** near their natural hour (`naturalMinutes`:
   breakfast 08:30, lunch 13:00, dinner/supper 19:00) → **workouts** (`isWorkout`) placed to *end
   exactly when a meal starts*, so the day always reads **exercise → lunch** or **exercise →
   dinner** → everything else longest-first into the **roomiest** gap.
   **Meal times are collected from *both* fixed and flexible routines** (`mealStarts` is filled in
   phase 1 as well as phase 2) — the user's Lunch/Dinner are **fixed** routines, and only counting
   the flexible ones left the workout with nothing to anchor to, which put lunch before exercise.
   **You eat after you train — a meal never comes directly before a workout.** When a calendar event
   makes adjacency impossible, the workout still goes in the roomiest gap that finishes *before* a
   meal, so the ordering survives. (This rule used to live in the AI prompt and was lost when that
   pass was deleted — it is now deterministic. Don't drop it again.)
2b. **A morning session is reserved first** — one Deep Work block before the first main meal
   (lunch/dinner; breakfast doesn't count) and therefore before the workout that anchors to it.
   It is carved **before** the workout is placed, because the workout would otherwise swallow the
   whole pre-lunch stretch and leave nothing big enough in front of it. Where a morning session and
   an exercise→lunch pairing can't both fit, **the morning session wins and the workout pairs with
   dinner instead** — both orderings the user accepts. A session that ends at a meal skips its
   `SESSION_BREAK` (the meal is the break, and reserving one only shoves lunch later).
3. **Deep Work sessions** — up to `plan_settings.deep_work_count` (default 2), carved from the
   biggest remaining stretches, clamped to `deep_work_min/max_minutes` (120/240), each reserving a
   30 min `SESSION_BREAK` after it so two sessions are never back-to-back. `kind = 'deep_work'`,
   one calendar event titled "Deep Work". **They start empty** — tasks go in by hand.
4. **Errands** — only `social` / `other` tasks (`isErrand`) get a slot of their own; focus work is
   never time-boxed, it lives in a session. Duration is the priority default.
   **A task with no priority (`priority = null`) is never auto-scheduled at all** — it stays a plain
   to-do on the list and can still be dropped into a session by hand. `priority` is nullable and its
   CHECK passes on NULL, so this needed no migration. `priorityRank()` sorts null below Low; the row
   accent is a muted rail; "None" is the first chip in `AddTaskBar` / `EditTaskSheet`.

There is **no model call in the planning path** — which is why the old `geminiSchedule` / `sanitize`
/ `geminiOrder` / `reflowByOrder` passes are gone, along with the whole class of overlap bugs they
caused. Gemini is still used for a single task's duration estimate (`estimateTaskMinutes`).
A packed day can legitimately yield **zero** sessions (no 2 h stretch left); the client says so
rather than looking broken.

**Session task lists** live in `lock_in.deep_work_items (block_id, task_id, position)` — no times, a
session is a container. `POST /api/game-plan/session-tasks` adds/removes. **Replanning rebuilds the
block rows, so `run.ts` captures each session's task list before the delete and re-attaches it to the
new sessions in start order** (dropping anything completed) — otherwise a hand-built list would
vanish on every replan. In the timeline a session renders as `DeepWorkCard`: gold-tinted, first
3 tasks inline (priority dot + checkbox), then "+N more · tap to manage" opening a sheet.
**Both session sheets reuse the main list's visual language** via `SessionTaskLine` — the same
priority rail, square gold checkbox and tag/due chips as `TaskRow`, sharing `PRIO_ACCENT` /
`formatDueChip` with the Replace picker. The manage sheet lists the session's tasks (check off in
place, ✎ to edit the task, ✕ to remove, **press-and-hold a row to drag it** — the list reshuffles live and
`POST session-tasks {order}` renumbers `position` on release; the checkbox and ✕ carry `data-no-drag`
so they keep their taps); the picker turns each row into one tap target with a gold tint + ring when
selected. Both have grab handles, illustrated empty states and a full-width gold action button. Adding a one-off task from the Game Plan bar auto-assigns it to the current/next session
(`insert.ts`); an errand still gets its own slot.

**Timeline is interactive:** tap a block's checkbox to mark it done → the underlying task is completed
(`focus_gate.tasks.is_completed`) or the routine checked (`recurring_completions` for that date),
and `plan_blocks.status` flips — plan and list stay in sync. **Locked (calendar) blocks can also be
checked off** now, but it's **cosmetic only** (just `plan_blocks.status` — they have no task/routine
to complete, and the status resets on the next replan since locked blocks are re-read from the
calendar). **Yesterday / Today / Tomorrow** toggle (`DAY_OFFSET` −1/0/+1 from today) plans and
views a day (route takes `day`; `run.ts` takes `targetDate` — future days use the full work
window, today starts from now). The header is **one row**: calendar-bolt logo + **Game Plan** title
(left), then a compact day toggle + settings gear (top-right). The old date + connected-email subtitle
rows were removed (the toggle already names the day). The header is **width-responsive** via a
`min-[390px]:` breakpoint: below 390px (iPhone SE) it's compact (`text-base` title, `text-[10px]`
toggle, 20px logo / 18px gear) so it fits; at ≥390px (most phones) it scales up (`text-lg` title,
`text-[11px]` toggle, 22px logo / 20px gear) to fill the wider screen. 18px is the ceiling with the
toggle on the row — 20px truncates even at ~411px. Verify at iPhone SE **and** ~411px if you rework
this. **Yesterday is view-only** (no plan button — you don't schedule the
past — but its blocks are still tickable/editable): it exists so late-night hours past midnight can
still reach the plan they were living before the date rolled forward.

**Past-day sweep** (`lib/game-plan/sweep.ts` → `sweepStalePastDays`): once a day is in the past, any
block you **never checked off** is treated as not-done — its `plan_blocks` row is deleted **and its
Google Calendar event removed**. Applies to every day strictly before today (catches multi-day gaps).
Kept: `done`/`'continued'` blocks (history) and **locked** blocks (real calendar events we didn't
create — never deleted). Runs from **both** the daily cron (`plan-day`, for every connected user,
independent of auto-plan) **and** on app open (`POST /api/game-plan/sweep-past`, fired
fire-and-forget from `GamePlanClient` init when connected) so it happens even if the cron missed you. Blocks show a repeat glyph for routines and a tag-colored left
border + chip (`plan_blocks.category` denormalised, `0007`; `recurring_id` link, `0006`).

**The user's real calendar events are shown as locked blocks** (`plan_blocks.locked`, `0009`;
`listDayEvents` reads real timed events excluding our tagged ones — `run.ts` now cleans up *before*
reading so old GP events aren't re-read). Locked blocks show a small lock glyph, aren't draggable
or editable, and no calendar event is written for them (they already exist) — but they **can** be
checked off (cosmetic, see above) — and that checkmark **persists across replans**: `run.ts` carries
a locked block's `done` status over by its stable `gcal_event_id` when it re-creates locked rows. Each row has a **left time gutter** (fixed `w-11`, `self-stretch` + `justify-between`) with the
block's **start aligned to the top of the card and end to the bottom** (bracketing the block); both
times share the same style (`text-text-muted text-xs`). The card's meta line shows only the duration
(`N min`) + tags. **Press-and-hold anywhere on a movable block to pick
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
duration) and `patchEvent`s the calendar event. **Replace with another task** swaps a different
unscheduled task into the block's slot (`POST /api/game-plan/swap-block`): the picker lists open tasks
not already in the plan (rendered **task-list style** — priority accent bar + category/due chips);
choosing one keeps the slot's start/end, deletes the old calendar event and writes a new one for the
chosen task, and the old item just leaves the plan (stays on the list).
**Continue tomorrow** (task blocks only, `POST
/api/game-plan/continue-tomorrow`) snoozes the task to the next day (`snoozed_until` + `due_date`),
so today's replans skip it and the next day's plan schedules it with a **fresh AI duration
estimate**; a block you'd already started stays on today's timeline as progress (status
`'continued'` — gold arrow checkbox, "→ tomorrow" chip, trimmed to end at now, event patched), while
an unstarted block is removed. **Remove from plan** deletes only *that* block
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
- **Deep Work follow-ups (just shipped — watch these first):**
  - **On a packed day no session fits** (routines + meetings leave no 2 h stretch) and the client
    just says so. Open question for the user: should Deep Work outrank *flexible* routines (so a
    session is guaranteed and e.g. a 2 h workout gets dropped instead)? Right now routines win.
  - "Let AI pick what fits" (one-tap fill of a session from open tasks) is designed but not built.
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
