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
Live from `main` (deployed): the full-screen **HOLD UP** gate — Instagram deep-link (Android intent + iOS scheme with web fallback), the **Lock in** / **Having a break** buttons, and the signed-in suggestion (Gemini pick + heuristic fallback), presented as:

- **Suggested tasks → soft-glow panel.** A single card grouped just above the hero: a gradient-hairline border + soft outer glow that echoes the CTAs (dimmed, so the buttons stay the loudest thing), inner `#161618`, a small IG-gradient brand dot beside the `Suggested tasks` header, and **up to two** AI-picked active tasks as **title + due chip** split by a hairline divider. **Priority drives title emphasis** (high = bold full-white, medium = full-white, low = muted); **due-date urgency drives the chip colour** (Overdue = `coral`, Today/Tomorrow = `amber`, otherwise `text-low`). Real data only — `priority`/`dueDate` come from the task row, Gemini returns IDs. Same priority + due-date + time-of-day scoring as before (in the route). With no active tasks the panel simply doesn't render (just wordmark + buttons).
- **Friction before Instagram — the dodging "Having a break" button.** Pressing it makes the button bolt: it shrinks/fades out and springs back in at a random on-screen spot (a real jump — enforced min-distance from where it was). Respawn odds are **75% / 50% / 33%** for at most **three** dodges; a failed roll — or the fourth press once respawns are spent — lets you through to Instagram. "Lock in" never moves (an invisible same-size placeholder holds its slot). Tunable via `DODGE_ODDS` in `app/page.tsx`. `openInstagram()` / `goLockIn()` unchanged.
- **Sign-in on the gate.** The panel needs an authenticated user, and each app is its own `vercel.app` domain (so Lock In's session doesn't carry over) — the gate therefore has its own Google sign-in. Signed out → a quiet `Sign in to see your tasks` pill sits in the panel's slot; tapping it runs `signInWithOAuth` (Google) and returns via the existing `/auth/callback` (whose focus-gate redirect URLs were already in Supabase's allow-list). Signed in with no active tasks → nothing renders. No sign-out UI yet. `signedIn` state: `null` while checking → `true`/`false`.
- **Instant repeat paint.** Suggestions + the signed-in flag are cached in `localStorage` (`fg_suggested_v1`) and applied via an isomorphic layout effect, so on repeat visits the panel paints in the **same frame as the gate** instead of after the session + DB + AI round-trips. A background refresh (`getSession` → tasks → `/api/suggest`) then updates the panel and re-writes the cache; the client auth check uses `getSession` (no extra round-trip vs `getUser`). First load with an empty cache still waits one cycle.

The earlier boxed-card / popup / boxless-dot-list presentations, the `?lay`/`?sty` explorers, and the `?demo=1` preview sample were all removed once the look was chosen — production-clean.

## Next
- **De-hardcode the Lock In URL** (`LOCK_IN_URL` in `app/page.tsx`) — iron-rule #1. The value already lives in `apps/hub/config/apps.json` (slug `lock-in`), but focus-gate can't cleanly read across to it until a shared `packages/` workspace exists; reaching into the hub app directly would couple their builds. Bundled into the deferred structure pass (root `CLAUDE.md` → Current phase → Next) — needs the cross-app design discussion first.
- **Tune the dodge on a real phone** — adjust `DODGE_ODDS` / max respawns if the friction feels too easy or too annoying in the hand.
- **Sign-out** — there's sign-in but no sign-out yet; add one if you ever need to switch accounts on the gate.
