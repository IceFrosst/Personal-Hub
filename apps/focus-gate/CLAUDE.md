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
- **`/api/suggest` queries the tasks itself** (server-side, via the SSR Supabase client) — it never trusts a task list from the request body. The client POSTs only `{ clientHour, clientDate }`. `markSuggested` computes `suggestion_count + 1` from the rows the route just read, so counts can't be pumped from outside.
- **Per-user Gemini throttle** in the route: if the newest `last_suggested_at` across the user's active tasks is under 20s old (`THROTTLE_MS`), the response comes from the deterministic heuristic — no Gemini call, no `markSuggested` (Google sign-up is open and the Gemini free tier is 1,500 req/day). The Gemini fetch itself is bounded by `AbortSignal.timeout(5000)`, key in the `x-goog-api-key` header.
- **Time and date are the client's local clock**: `clientHour` drives the morning/afternoon/evening/late-night bucket, `clientDate` ('YYYY-MM-DD') drives due-date urgency — Vercel runs UTC, so server time can be a day off near midnight. Both fall back to server time if absent/malformed.
- The `focus_gate` schema must stay exposed to PostgREST (granted in Lock In's migration `0002`) or API reads 404.

## Current state
Live from `main` (deployed): the full-screen **HOLD UP** gate — Instagram deep-link (Android intent + iOS scheme with web fallback), the **Lock in** / **Having a break** buttons, and the signed-in suggestion (Gemini pick + heuristic fallback), presented as:

- **Suggested tasks → soft-glow panel.** A single card grouped just above the hero: a gradient-hairline border + soft outer glow that echoes the CTAs (dimmed, so the buttons stay the loudest thing), inner `#161618`, a small IG-gradient brand dot beside the `Suggested tasks` header, and **up to two** AI-picked active tasks as **title + due chip** split by a hairline divider. **Priority drives title emphasis** (high = bold full-white, medium = full-white, low = muted); **due-date urgency drives the chip colour** (Overdue = `coral`, Today/Tomorrow = `amber`, otherwise `text-low`). Real data only — `priority`/`dueDate` come from the task row, Gemini returns IDs. Same priority + due-date + time-of-day scoring as before (in the route). With no active tasks the panel simply doesn't render (just wordmark + buttons).
- **Friction before Instagram — the dodging "Having a break" button.** Pressing it makes the button bolt: it shrinks/fades out and springs back in at a random on-screen spot (a real jump — enforced min-distance from where it was, **and never overlapping the "Lock in" rect**, measured live via a ref with a 12px margin; bounded retries with a safe top-left fallback). Respawn odds are **75% / 50% / 33%** for at most **three** dodges; a failed roll — or the fourth press once respawns are spent — lets you through to Instagram. "Lock in" never moves (an invisible same-size placeholder holds its slot). Tunable via `DODGE_ODDS` in `app/page.tsx`. On iOS the 800ms web-Instagram fallback bails if the page was hidden in the meantime (native app opened), so returning to the gate doesn't yank you to instagram.com.
- **Sign-in on the gate.** The panel needs an authenticated user, and each app is its own `vercel.app` domain (so Lock In's session doesn't carry over) — the gate therefore has its own Google sign-in. Signed out → a quiet `Sign in to see your tasks` pill sits in the panel's slot; tapping it runs `signInWithOAuth` (Google) and returns via the existing `/auth/callback` (whose focus-gate redirect URLs were already in Supabase's allow-list; the callback only redirects to same-origin paths — open-redirect-safe). If the OAuth kick-off errors, the pill flips to `Sign-in failed — tap to retry`. Signed in with no active tasks → nothing renders. No sign-out UI yet. `signedIn` state: `null` while checking → `true`/`false`.
- **Loads together, always fresh.** The gate holds behind a small spinner until suggestions are settled, then reveals the wordmark + buttons + panel **together** (fade via the `gate-in` keyframe in `globals.css`). No caching — `/api/suggest` re-queries the user's incomplete tasks server-side on every open, so it never flashes an already-done task; the client sends only `{ clientHour, clientDate }` (no client-side task query — one round-trip fewer behind the spinner). `getSession` (local, no round-trip) lets signed-out users through near-instantly; signed-in users wait for `/api/suggest` (AbortController + `LOAD_TIMEOUT_MS` safety so the gate never hangs on the loader — and a late response after that safety reveal is dropped, so the panel never pops in and shoves the hero). The `ready` state drives the loader→gate swap.
- **Service worker `focus-gate-v2`.** On activate it deletes any cache that isn't the current name; it caches only same-origin GET responses with `res.ok`, never `/api/` or `/auth/` (auth redirects must never come from cache), and the offline fallback resolves to the cached response or `Response.error()` — never `undefined`. The middleware matcher also skips `manifest.json`, `sw.js` and `icons/`, so PWA asset fetches don't cost a `supabase.auth.getUser()` round-trip.

The earlier boxed-card / popup / boxless-dot-list presentations, the `?lay`/`?sty` explorers, and the `?demo=1` preview sample were all removed once the look was chosen — production-clean.

**Disguise icon.** The PWA masquerades as Instagram (`manifest.json` name/short_name `Instagram`). The icons (`public/icons/instagram-{180,192,512,512-maskable}.png`) are regenerated from an SVG (rounded squircle, bottom-left radial IG gradient, camera glyph + top-right flash dot) to match the real app icon as seen on the home screen — the maskable variant is full-bleed with the glyph pulled into the safe zone. Regenerate via the SVG-in-Chromium approach (no ImageMagick in the env); keep all four sizes in sync.

## Next
- **De-hardcode the Lock In URL** (`LOCK_IN_URL` in `app/page.tsx`) — iron-rule #1. The value already lives in `apps/hub/config/apps.json` (slug `lock-in`), but focus-gate can't cleanly read across to it until a shared `packages/` workspace exists; reaching into the hub app directly would couple their builds. Bundled into the deferred structure pass (root `CLAUDE.md` → Current phase → Next) — needs the cross-app design discussion first.
- **Tune the dodge on a real phone** — adjust `DODGE_ODDS` / max respawns if the friction feels too easy or too annoying in the hand.
- **Sign-out** — there's sign-in but no sign-out yet; add one if you ever need to switch accounts on the gate.
- **Spinner latency** — partially addressed: the client-side task query is gone (the route fetches tasks itself), removing a serial round-trip, and the Gemini call is capped at 5s. Signed-in users still wait on Gemini behind the loader (bounded by `LOAD_TIMEOUT_MS`, currently 7s); if it still feels slow in the hand, the remaining lever is speed — a faster model or a trimmed `/api/suggest` prompt — deliberately **not** caching (we want the pick fresh, never a possibly-done task).
