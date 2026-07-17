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
  `fetchMlh` refuses to return an empty result silently: no season page fetching OK
  throws with per-season HTTP statuses, and pages that fetch OK but parse to zero cards
  throw with a markup fingerprint (page size, anchor count, `event`-ish class names) so
  the cron report itself says what the new markup looks like.
- Exposing the `hackathon` schema to the Data API needs the platform config **and** the
  `authenticator` role's `pgrst.db_schemas` + both `notify pgrst` reloads — see the
  "Data API exposure" section in root `SCHEMA_RULES.md` (this bit Event Radar's first
  cron run with `Invalid schema: hackathon`).
- Vercel Hobby cron = once per day max, ±59min jitter, `maxDuration` 60s. The route
  self-budgets to 45s and enriches at most 10 rows per run — the backlog drains over
  days. Don't raise the batch without checking function duration limits.
- Push payload URLs must stay relative (`'/'`) — iron rule #1, no hardcoded app URLs.
- `sendPush` returns `'gone'` for 404/410 → the cron deletes those subscription rows.
- iOS requires the PWA to be installed to home screen before push permission can be asked.

## Current state

**Live in production** — ships from `main`, hub tile registered. Ranked feed with
why-chips + filters, status tracking, settings with push toggle + threshold slider, daily
ingest cron (Devpost + MLH → insert/touch → Groq/Gemini enrichment → scored web-push
notify). Migration applied to the shared Supabase project; schema exposed via PostgREST.
Vercel project fully provisioned: root dir + turbo-ignore + all env vars
(`NEXT_PUBLIC_SUPABASE_*`, VAPID key pair, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
`GROQ_API_KEY`, `GEMINI_API_KEY`). Auth redirect URLs added.

First cron run verified in production (triggered manually with the `CRON_SECRET` bearer
token): Devpost 27 gathered → 27 inserted, first enrichment batch of 10 processed with
sane values (`format`, `prize_pool`, `registration_deadline`; nulls where unknown), 0
pushes (no subscribers yet). Fixed en route: the `hackathon` schema wasn't actually
exposed (authenticator-role gotcha, see Gotchas) and MLH HTTP failures were silently
swallowed (now surfaced in `sources.mlh`).

## Next

- Fix the MLH parser: production fetches the season pages fine (HTTP 200) but the
  `event-link` card regexes match nothing — markup drift, confirmed via the cron's
  per-source report. The drift error now includes the page's `event`-ish class names;
  use those to rewrite the regexes in `parseMlhHtml`.
- Ignas: install the PWA on the Pixel, log in, and test push notifications end-to-end.
- Roadmap (per EVENT_RADAR_PLAN.md): more sources (the EU travel-reimbursing circuit),
  Apply Kit, approval-gated auto-fill via Claude Code cloud sessions, night search agents.
