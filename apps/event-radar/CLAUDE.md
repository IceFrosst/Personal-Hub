# Event Radar — Claude context

## Stack

- Next.js 15 App Router + TypeScript, Tailwind (portfolio mauve palette, purple accent,
  blue highlights — hex tokens in `tailwind.config.ts`)
- Supabase shared portfolio project (`qcsyihymmaktkbqfxlkl`), schema `hackathon`,
  Google OAuth via `@supabase/ssr` (browser/server/admin clients in `lib/supabase/`)
- PWA: `public/manifest.json` + `public/sw.js` (network-first cache + Web Push handlers)
- Vercel project `icefrosst-event-radar` (`prj_HMJPGoTi3Etml4iGk6gxLOX9gFyf`), Root
  Directory `apps/event-radar`, Ignored Build Step `npx turbo-ignore`, production = `main`
- Daily cron (`vercel.json`): `GET /api/cron/ingest` at 05:00 UTC ±59min (Hobby tier limit)

## Conventions

- Score is **computed at read time** (`lib/scoring.ts`), never stored — re-weighting is a
  code change, not a migration. The same function runs in the feed (client) and the notify
  phase (server); keep them identical.
- Enrichment (`lib/ingest/enrich.ts`): Groq `llama-3.3-70b-versatile` primary (high-volume
  structured extraction per root CLAUDE.md model guidance), Gemini Flash fallback, and a
  hard rule that a failed extraction leaves fields `null` ("unknown") — never guessed.
- Ingest sources return `IngestRow[]` and throw on total failure; the cron reports
  per-source errors in its JSON response instead of dying (check the Vercel cron logs).
- Global `hackathons` table is written **only** by the cron via the service-role client
  (`lib/supabase/admin.ts`). RLS has a select-only policy for authenticated users.
- Per-user tables (`user_hackathon_status`, `user_preferences`, `push_subscriptions`) are
  written directly from the browser client; RLS scopes rows to `auth.uid()`.

## Data model

Schema `hackathon` (migration `supabase/migrations/0001_init.sql`, applied 2026-07-17,
additive-only forever):

- `hackathons` — global catalog. `unique (source, url)`; enrichment-owned columns
  (`travel_covered`, `accommodation_covered`, `open_to_business_students`, `format`,
  `city`, `country`, `registration_deadline`, `raw_description`) + `enriched_at`,
  `notified_at` markers.
- `user_hackathon_status` — PK `(user_id, hackathon_id)`, status
  `interested|applying|applied|hidden`.
- `user_preferences` — `filters` jsonb (reserved), `notification_settings` jsonb
  (`{enabled, min_score}`, default threshold 60).
- `push_subscriptions` — one row per browser endpoint, `endpoint` unique.

Schema is in PostgREST's exposed list (`db_schema` includes `hackathon`) and granted to
anon/authenticated/service_role — grants unlock the API, RLS gates the rows.

## Gotchas

- **devpost.com / mlh.io are NOT in the Claude Code session allowlist** — scraper code
  can't be live-tested in-session (403 from the egress proxy). Production Vercel has open
  egress. To test locally in a session, ask Ignas to allowlist those domains.
- Devpost's JSON API is unofficial: tolerate missing fields; `prize_amount` arrives as
  HTML. MLH is a regex parse of static HTML — when it drifts, `parseMlhHtml` returns `[]`
  and the cron's `sources.mlh` reports it. Fix the regexes, don't add a headless browser.
- Vercel Hobby cron = once per day max, ±59min jitter, `maxDuration` 60s. The route
  self-budgets to 45s and enriches at most 10 rows per run — the backlog drains over
  days. Don't raise the batch without checking function duration limits.
- Push payload URLs must stay relative (`'/'`) — iron rule #1, no hardcoded app URLs.
- `sendPush` returns `'gone'` for 404/410 → the cron deletes those subscription rows.
- iOS requires the PWA to be installed to home screen before push permission can be asked.

## Current state

Scaffolded and fully wired (2026-07-17): ranked feed with why-chips + filters, status
tracking, settings with push toggle + threshold slider, daily ingest cron (Devpost + MLH →
insert/touch → Groq/Gemini enrichment → scored web-push notify). Migration applied to the
shared Supabase project; schema exposed via PostgREST. Vercel project created with root
dir + turbo-ignore + `NEXT_PUBLIC_SUPABASE_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `CRON_SECRET` set. Auth redirect URLs added. `next build` green.
**Not yet live**: ships when the branch merges to `main`.

## Next

- **Handoff:** Ignas must add 3 env vars to the `icefrosst-event-radar` Vercel project
  before the cron does real work: `SUPABASE_SERVICE_ROLE_KEY` (password manager),
  `GROQ_API_KEY`, `GEMINI_API_KEY` (both in session env / dashboards). Until then the
  cron returns 503 — the app itself works, feed is just empty.
- Merge to `main` → first deploy → verify first cron run via Vercel logs (per-source
  error report in the response), then test push + install on the Pixel.
- Roadmap (per EVENT_RADAR_PLAN.md): more sources (the EU travel-reimbursing circuit),
  Apply Kit, approval-gated auto-fill via Claude Code cloud sessions, night search agents.
