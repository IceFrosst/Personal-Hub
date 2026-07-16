# HANDOFF — living state for the next agent

> **Purpose.** A durable, always-current "state of play" so any agent (Grok or
> otherwise) can continue this work even if the previous session died mid-task.
> **Read this first, then the relevant `apps/<name>/CLAUDE.md`.** The repo root
> `CLAUDE.md` governs the whole portfolio; each app's `CLAUDE.md` has its live
> `Current state` / `Next`. This file is the *cross-session handoff* on top of those.
>
> **Keep it live.** Whoever works here updates the three dated sections below
> (Now / Open follow-ups / Watch-outs) as part of the same change that alters the
> code — not only at session end. The rule of thumb: **anything pushed is a valid
> resume point.** Commit + push frequently so the last push is always a clean handoff.

_Last updated: 2026-07-16 by Claude (Opus 4.8)._

---

## Active work

- **Feature:** "Game Plan" — the AI day-scheduler inside **Lock In** (`apps/lock-in`).
  Integrates Google Calendar + the task list, uses Gemini to estimate durations and
  time-block the day around real calendar events, writes blocks as real calendar
  events, and shows an in-app timeline.
- **Branch:** `claude/calendar-scheduling-integration-2i16nd`. All Game Plan work
  ships from here via squash-merged PRs into `main`.
- **Status:** Feature is **live in production** (`icefrosst-lock-in.vercel.app`).
  PRs #43–#51 are all merged + deployed. No work is mid-flight in code right now —
  the open items below are product decisions / cleanups, not half-written code.

## Where things live (Game Plan)

- Orchestration: `apps/lock-in/lib/game-plan/run.ts` (loads tasks + routines,
  freezes the past, cuts at now, plans the rest, writes events + rows).
- Planner: `apps/lock-in/lib/game-plan/planner.ts` (`planDay` — fixed routines
  deterministic, flex via Gemini with fallback packer; day-shape strategy).
- Google Calendar: `apps/lock-in/lib/google/calendar.ts`.
- API routes: `apps/lock-in/app/api/game-plan/{plan,reorder,connect,cleanup-blocks,adjust-routine}/route.ts`
  + `app/api/cron/plan-day/route.ts`.
- UI: `apps/lock-in/components/GamePlanClient.tsx` (timeline, drag, edit sheets),
  `EditTaskSheet.tsx`, `EditRecurringSheet.tsx`. Task list: `app/page.tsx`.
- **Full technical detail is in `apps/lock-in/CLAUDE.md`** — keep that authoritative.

## Recently shipped (so you don't re-do it)

- Replan **freezes the past and cuts at now**: started blocks stay; the block you're
  in is trimmed to end at now; new work starts at the cutoff (PRs #44, #45).
- **Quick-win opener only on a fresh (start-of-day/future) plan**, not a mid-day
  replan (`fresh = earliestStart <= work_start`) (#46).
- Game Plan blocks: **hold-anywhere-to-drag**, **pencil button** (right of each block)
  opens Edit/Delete, **two-way sync** of title/priority/category between list and plan
  (#47, #49).
- Routine **time/duration edits adjust the existing block instantly** via
  `/api/game-plan/adjust-routine` (#48).
- Game Plan delete = **"Remove from plan"** (block only, keeps the task/routine);
  permanent delete lives on the task list (#50).
- **Reorder is bounded by `work_end`** — overbooked blocks drop instead of cascading
  past midnight into invalid `24:00+` times (#51).

## Open follow-ups (product decisions, not started)

1. **Work window vs. evening routines.** Default planning window is `09:00–18:00`
   (`DEFAULT_SETTINGS` in `lib/game-plan/types.ts`), but the user schedules evening
   routines (Dinner/Exercise ~20:00–22:00). Options to discuss with the user: raise
   default `work_end`; rename "work hours" → "planning window"; or allow fixed-time
   routines outside the window. **Do not just change the default — ask.**
2. **Duplicate routine names.** The user has two routines both named
   "Prediction markets + X" (fixed 09:00 and fixed 20:00). Not a bug, but confusing.
   Suggest renaming one — user's call.
3. **User action pending:** user should hit **Replan my day** once to clear old
   past-midnight blocks left in the DB/calendar from the pre-#51 overflow bug.

## Deferred / ideas (from `apps/lock-in/CLAUDE.md` → Next)

- Duration learning (learn actual task durations vs. Gemini guesses).
- Settings depth: per-weekday work hours, timezone picker.
- Block-start web-push notifications.

## Watch-outs (things that will bite you)

- **Stop-hook "Unverified commit" noise.** After a squash-merge, GitHub's merge
  commit (authored `noreply@github.com`) lands on `main`; the local branch tracks it.
  The stop hook flags it as unverified — **ignore it for merge commits you didn't
  author.** Only amend/reset-author commits *you* wrote and haven't pushed.
- **Vercel occasionally misses the production build webhook** on merge. If `main`'s
  HEAD has no production deployment after a few minutes, trigger it manually:
  `POST https://api.vercel.com/v13/deployments?teamId=$VERCEL_TEAM_ID&forceNew=1`
  with `{name:"icefrosst-lock-in", project:"prj_tMXTbtNJpeVC7sCYhr1htC9Zuvh0",
  target:"production", gitSource:{type:"github", repoId:1250114386, ref:"main", sha:"<merge-sha>"}}`.
  Poll `/v13/deployments/<id>` until `readyState:READY`.
- **Gemini model:** `GEMINI_MODEL || 'gemini-flash-latest'` (rolling free alias).
  `gemini-2.5-pro` has **no free tier** (429s always) — don't set it as default.
  `generateJson` retries 5xx + falls back to `gemini-flash-lite-latest`.
- **Iron rules (root `CLAUDE.md`):** schema is additive-only (never rename/drop/narrow);
  RLS on every user-data table; one Supabase project; no hardcoded URLs outside
  `apps/hub/config/apps.json`. 100% free-tier only — flag anything that would cost money.

## Workflow (how to ship here)

1. Rebase branch onto `origin/main` before new work
   (`git fetch origin main && git checkout -B claude/calendar-scheduling-integration-2i16nd origin/main`).
2. Change code in `apps/lock-in`. `cd apps/lock-in && npx tsc --noEmit && npm run build`.
3. Update `apps/lock-in/CLAUDE.md` (`Current state`/`Next`) **and this file** in the same commit.
4. Commit (say *why*), push `--force-with-lease` (branch tracks squash-merged history).
5. Open PR, squash-merge, poll the Vercel production deploy to READY (manual trigger if the webhook was missed).
