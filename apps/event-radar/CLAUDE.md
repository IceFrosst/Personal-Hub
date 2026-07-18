# Event Radar — shared agent context

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
- Feed and notification eligibility is **fail-closed** (`isUpcomingAndOpen` in
  `lib/scoring.ts`): both `starts_at` and `registration_deadline` must parse as valid
  timestamps and must be strictly later than now. Missing, malformed, already-started, or
  closed-registration rows never qualify.
- Enrichment (`lib/ingest/enrich.ts`): Groq `llama-3.3-70b-versatile` primary (high-volume
  structured extraction per root CLAUDE.md model guidance), Gemini Flash fallback, and a
  hard rule that a failed extraction leaves fields `null` ("unknown") — never guessed.
- Ingest sources return `IngestRow[]` and throw on total failure; the cron reports
  per-source errors in its JSON response instead of dying (check the Vercel cron logs).
  Five sources: devpost, mlh, ethglobal, hackerearth, hackclub (`lib/ingest/*.ts`).
  `IngestRow.registration_deadline` is optional — only ETHGlobal provides it; enrichment
  fills it elsewhere and never overwrites a source-provided value.
- The shared server runner (`lib/ingest/run.ts`) owns gather/enrich/notify. The scheduled
  cron calls it with notifications enabled; the owner-only manual route
  (`POST /api/ingest/refresh`) calls it with notifications disabled. Never send
  `CRON_SECRET` or the service-role key to the browser.
- Inserts ignore duplicate conflicts, and enrichment marks rows complete only after the
  page fetch and enrichment attempt finish; failed page fetches stay retryable. Overlapping
  cron/manual runs can duplicate an external enrichment request, but cannot fail a whole
  insert batch or mark a partial row complete.
- Manual refresh authorization is checked against the verified Supabase user email via
  `lib/owner.ts`; `EVENT_RADAR_ADMIN_EMAIL` can override the portfolio-owner default.
- Global `hackathons` writes use the service-role client (`lib/supabase/admin.ts`). RLS has
  a select-only policy for authenticated users; no other browser or API path gets admin
  access.
- Per-user tables (`user_hackathon_status`, `user_preferences`, `push_subscriptions`,
  `application_profiles`, `application_drafts`) are written from the browser client or a
  cookie-authed route; RLS scopes rows to `auth.uid()`. No service role outside the shared
  ingest runner.
- Apply Kit: the profile's jsonb shape is owned by `lib/apply-kit.ts` (`coerceProfile`
  merges older/partial documents onto the current shape — evolve it there, never with a
  migration). Draft answers come from `POST /api/apply-kit/draft` (Groq primary, Gemini
  fallback, same split as enrichment); the drafter must never invent facts — profile gaps
  come back as inline `[TODO: …]` markers.
- Notes ride on the `user_hackathon_status` row (status is NOT NULL): saving a note with
  no status starts one at `interested`; clearing a status deletes the row, notes included.

## Data model

Schema `hackathon` (additive-only forever). Migration `0001_init.sql` applied 2026-07-17;
**`0002_apply_kit.sql` is committed but NOT yet applied** (the overnight session had no
`SUPABASE_ACCESS_TOKEN`) — apply it via the Management API before testing Apply Kit; the
UI degrades to a "not provisioned" notice until then. 0002 adds:

- `application_profiles` — PK `user_id`, `profile` jsonb (shape owned by
  `lib/apply-kit.ts`), RLS own-rows.
- `application_drafts` — PK `(user_id, hackathon_id)`, `questions`/`answers` jsonb,
  `model` text, RLS own-rows.

From 0001:

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

- **Egress varies by session type.** Interactive Claude Code sessions only reach
  allowlisted domains (devpost/mlh 403 through the egress proxy), but scheduled/cloud
  sessions can have open egress — probe with curl before assuming scrapers are untestable.
  Caveat: Node `fetch` does NOT use the session's HTTPS proxy, so a WAF can 403 direct
  requests while curl (proxied) succeeds — HackerEarth does exactly this. Production
  Vercel has open egress with different IPs again.
- Devpost's JSON API is unofficial: tolerate missing fields; `prize_amount` arrives as
  HTML. Don't add a headless browser for any source.
- **MLH moved to www.mlh.com (2026-07):** the Inertia page object now lives as the BODY
  of a `<script data-page="app" type="application/json">` tag — the `data-page`
  attribute itself is a 3-byte decoy. `parseMlhInertia` scans attribute AND script-body
  candidates for event-shaped arrays (camelCase fields: `startsAt`, `endsAt`,
  `formatType`, `websiteUrl`, `venueAddress`), merges every event array (upcoming +
  past), and `fetchMlh` drops events that already ended — the page carries 250+ past
  events that would flood the catalog. The legacy card-regex parser (`parseMlhHtml`)
  still runs first in case they server-render cards again.
- `fetchMlh` refuses to return an empty result silently: no season page fetching OK
  throws with per-season HTTP statuses, and a page that fetches OK but yields zero
  events throws with a structural fingerprint (page size, anchors, Inertia component +
  props keys) so the cron report itself says where the data moved. Zero rows *after*
  the ended-events filter is a truthful empty, not drift.
- ETHGlobal is a Next.js App Router page: events ride the RSC flight stream
  (`self.__next_f.push` chunks). `lib/ingest/ethglobal.ts` decodes and scans it like the
  MLH approach; meetups/cafes/summits and finished/cancelled events are filtered out.
- Hack Club: use `/api/events/upcoming` — the bare `/api/events` path serves the SPA
  shell, not JSON.
- The same hackathon can arrive from two sources (e.g. MLH + Hack Club) as two rows —
  dedupe is per-source URL only. Known trade-off; revisit if it gets noisy.
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
ingest cron (five sources → insert/touch → Groq/Gemini enrichment → scored web-push
notify). Vercel project fully provisioned (root dir + turbo-ignore + all env vars);
auth redirects added; migration 0001 applied and schema exposed via PostgREST.

Overnight session (branch `claude/stoic-volta-e8or22`, merged):
- **MLH parser fixed for the www.mlh.com rebuild and verified live in-session: 63
  upcoming events** (production cron had been reporting `parsed 0 events`).
- **Three new sources**, live-tested in-session: ethglobal 4 (with exact signup
  deadlines), hackclub 15, devpost 27; hackerearth parser validated via proxy but its
  WAF 403s the sandbox's direct IP — watch its per-source result in production.
- **Detail sheet** (tap a card): metadata, score breakdown, status buttons, notes UI
  (first use of the `notes` column), enriched description, Apply Kit.
- **Apply Kit**: autosaving profile editor at `/profile` (linked from Settings), draft
  route `POST /api/apply-kit/draft`, drafts persisted per hackathon and restored in the
  sheet. **Blocked on migration 0002 being applied** — UI degrades until then.

Codex session (PR #61):
- Feed and push eligibility now share the strict future-start + open-registration rule.
- Settings has an owner-only manual source refresh with loading and per-source result
  feedback. It runs gather/enrich but intentionally skips push notifications.
- Eligibility, owner authorization, and refresh-summary regression coverage runs with
  `npm test` from this app.

## Next

**Handoff:** Migration 0002 (`supabase/migrations/0002_apply_kit.sql`) is NOT applied —
run it via the Management API, then test Apply Kit end-to-end. Risk: it is additive and
unused until applied; existing features are unaffected.

- The strict eligibility rule can produce an empty feed when sources have no row with
  both a future start and future registration deadline. Use the manual Settings refresh
  to inspect source counts, then check the stored source date semantics before relaxing
  the fail-closed rule.

- Read the next production cron report: expect `sources.mlh` ≈ 60+, `ethglobal`/
  `hackclub` small counts, and see whether `hackerearth` 403s from Vercel IPs (if it
  does, decide keep-or-drop).
- Ignas: install the PWA on the Pixel, log in, test push end-to-end, and try Apply Kit
  after 0002 is applied.
- Roadmap (per EVENT_RADAR_PLAN.md): approval-gated auto-fill via Claude Code cloud
  sessions, night search agents, more EU travel-reimbursing sources.
