# Focus Gate — app context (`apps/focus-gate`)

> Read the repo-root `CLAUDE.md` and `SCHEMA_RULES.md` first — they govern every app.
> **Keep `Current state` and `Next` (bottom) up to date — update them after every change to this app.**

Intentional Instagram replacement: a full-screen **"HOLD UP"** gate that sits in the
Instagram muscle-memory slot. Two buttons — **Lock in** (jumps to the Lock In app) and
**Having a break** (deep-links to Instagram). When signed in it shows a Gemini-picked
"Maybe do this first?" task above the buttons.

## Stack
- Next.js 15 (App Router, `next 15.5.18`) + React 19 + TypeScript
- Tailwind 3 + Radix Colors (`@radix-ui/colors`), dark/black only — **no `@tabler` here** (uses the IG-style wordmark, not Tabler icons)
- Supabase SSR (`@supabase/ssr`) — Google OAuth, shared `focus_gate` schema
- Gemini `gemini-2.0-flash` for the suggestion, **server-side only**, with a deterministic fallback
- ESLint flat config (`eslint.config.mjs`), `next.config.ts` (empty), PWA (manifest + `public/sw.js`)
- Prod: `icefrosst-focus-gate-personal-app.vercel.app` (Vercel project `icefrosst-focus-gate-personal-app`, Root Directory `apps/focus-gate`)

## Conventions
- App code in `app/` (no `src/`). Path alias `@/*` → app root.
- Supabase: browser client `lib/supabase/client.ts`, server client `lib/supabase/server.ts`. `middleware.ts` **only refreshes the session** (matcher excludes `_next` + static assets) — no routing/redirect logic lives there.
- Gemini lives in `app/api/suggest/route.ts` — never call it from the client, always keep the heuristic fallback, use `generationConfig: { responseMimeType: 'application/json' }` for structured output.

## Data model
- **Owns** the shared table `focus_gate.tasks` (created in `supabase/migrations/0001_focus_gate_tasks.sql`): `id, user_id, title, is_quick, is_completed, created_at, last_suggested_at, suggestion_count`.
- **Lock In writes to this same table** and has added `priority` + `due_date`. Additive-only — see `SCHEMA_RULES.md`. Never drop/rename a column another app may use.
- Accessed via `.schema('focus_gate').from('tasks')`. RLS gates every row by `user_id = auth.uid()`.

## Gotchas
- **Hardcoded cross-app URL** — `app/page.tsx` hoists the Lock In URL to a `LOCK_IN_URL` constant (`https://icefrosst-lock-in.vercel.app`). This still violates **iron-rule #1** (cross-app URLs belong in `apps/hub/config/apps.json`); the constant just keeps it to one spot until shared config exists. Update it here if Lock In's URL changes. (The Instagram deep-links are external app links, not portfolio URLs — those are fine.)
- The suggestion considers only **active** (`is_completed = false`) tasks and lists **up to two** (`MAX_SUGGESTIONS` in the route), scored on priority + due date + time of day. The API returns `{ suggestions: Suggestion[] }`; each `Suggestion` carries `priority`/`dueDate` taken from the task row (not trusted from Gemini, which only returns task IDs).
- **Time of day is the client's local hour**, sent as `clientHour` in the POST body — Vercel runs UTC, so don't rely on server time for the morning/afternoon/evening/late-night bucket.
- The `focus_gate` schema must stay exposed to PostgREST (granted in Lock In's migration `0002`) or API reads 404.

## Current state
Live from `main`: the gate screen, Instagram deep-link (Android intent + iOS scheme with web fallback), and the signed-in Gemini suggestion with heuristic fallback.

**Uncommitted on branch `claude/zealous-rubin-J8egx` (built, `next build` passes, verified via `?demo=1` — not yet deployed):**

- **Suggested tasks → soft-glow panel.** The suggestion is now a single card grouped just above the hero: a gradient-hairline border + soft outer glow that echoes the CTAs (dimmed, so the buttons stay the loudest thing), inner `#161618`, a small IG-gradient brand dot beside the `Suggested tasks` header, and **up to two** AI-picked active tasks as **title + due chip** split by a hairline divider. **Priority drives title emphasis** (high = bold full-white, medium = full-white, low = muted); **due-date urgency drives the chip colour** (Overdue = `coral`, Today/Tomorrow = `amber`, otherwise `text-low`). Still real data only — `priority`/`dueDate` come from the task row, Gemini returns IDs. Same priority + due-date + time-of-day scoring as before (in the route, unchanged). The earlier boxed-card / popup / boxless-dot-list and the `?lay`/`?sty` explorers were dropped now that the look is chosen.
- **Friction before Instagram — the dodging "Having a break" button.** Pressing it makes the button bolt: it shrinks/fades out and springs back in at a random on-screen spot (a real jump — enforced min-distance from where it was). Respawn odds are **75% / 50% / 33%** for at most **three** dodges; a failed roll — or the fourth press once respawns are spent — lets you through to Instagram. "Lock in" never moves (an invisible same-size placeholder holds its slot). Tunable via `DODGE_ODDS` in `app/page.tsx`. `openInstagram()` / `goLockIn()` unchanged.
- `?demo=1` still renders sample suggestions for previewing without auth/Gemini and must be removed before production.

## Next
- **Remove the `?demo=1` sample** from `app/page.tsx` before shipping to production.
- **De-hardcode the Lock In URL** (`LOCK_IN_URL` in `app/page.tsx`) — iron-rule #1; source it from shared config once `packages/` exists.
- **Tune the dodge on a real phone** — adjust `DODGE_ODDS` / max respawns if the friction feels too easy or too annoying in the hand.
