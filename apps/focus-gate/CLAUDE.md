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
- The suggestion considers only **active** (`is_completed = false`) tasks and picks **one**, scored on priority + due date + time of day.
- **Time of day is the client's local hour**, sent as `clientHour` in the POST body — Vercel runs UTC, so don't rely on server time for the morning/afternoon/evening/late-night bucket.
- The `focus_gate` schema must stay exposed to PostgREST (granted in Lock In's migration `0002`) or API reads 404.

## Current state
Live from `main`: the gate screen, Instagram deep-link (Android intent + iOS scheme with web fallback), and the signed-in Gemini single-task suggestion with heuristic fallback.

**Uncommitted on branch `claude/zealous-rubin-J8egx` (built, `next build` passes — not yet deployed):** the suggestion now scores across **all** active tasks by priority + due date + time of day, and is **gentle late at night** (prefers quick/small tasks, won't push a heavy one near bedtime); the same logic drives the heuristic fallback. Two presentations render **auto on load** — a bottom-sheet **popup** and the **inline card** — with a temporary preview toggle to compare them (`?s=popup`/`?s=card`, `?demo=1` for sample data). `lib/types.ts` gained optional `priority`/`due_date` (additive) and a shared `Suggestion` type.

## Next
- **Pick a presentation** — compare popup vs. inline on device, keep one, then remove the preview toggle + `?demo=1` sample from `app/page.tsx`.
- **De-hardcode the Lock In URL** (`LOCK_IN_URL` in `app/page.tsx`) — iron-rule #1; source it from shared config once `packages/` exists.
