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
  Eight sources: devpost, mlh, ethglobal, hackerearth, hackclub, unstop, devfolio, dorahacks
  (`lib/ingest/*.ts`). `IngestRow.registration_deadline` is optional — ETHGlobal and Unstop
  provide it up front; enrichment fills it elsewhere and never overwrites a source-provided value.
  The three JSON-API sources expose testable pure parsers (`parseUnstop`/`parseDevfolio`/
  `parseDoraHacks`, like `parseEthGlobal`); `test/new-sources.test.ts` covers the field mapping.
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

Schema `hackathon` (additive-only forever). Migrations `0001_init.sql` and
`0002_apply_kit.sql` both **applied 2026-07-18** via the Management API (0002 was applied
by the same session that added the throughput/cadence work below; Apply Kit is now
unblocked). 0002 adds:

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
- Three JSON-API sources added (all WAF-gated: 403 to interactive-session egress AND to
  WebFetch, so they can only be verified via the per-source production cron report):
  - **Unstop** (`unstop.ts`): `GET /api/public/opportunity/search-result?opportunity=hackathons
    &oppstatus=open&page=N`. Payload nests as `data.data.data[]` with `data.data.next_page_url`;
    `seo_url` is the full event URL, `regnRequirements.end_regn_dt` is the real registration
    deadline, `region` is online/offline. Capped at 3 pages.
  - **Devfolio** (`devfolio.ts`): `GET https://api.devfolio.co/api/hackathons?filter=
    application_open&page=N`, flat `result[]`, event site `https://<slug>.devfolio.co/`.
    We skip the per-event `/prizes` call (one request per row) — enrichment fills prize/format.
  - **DoraHacks** (`dorahacks.ts`): `GET /api/hackathon/?page=1&page_size=24&status=<upcoming|
    ongoing>`, `results[]` + `next`. `start_time`/`end_time` are **unix epoch seconds**;
    event page `https://dorahacks.io/hackathon/<uname>/detail`. Both statuses pulled, 3 pages each.
  Each `fetch*` throws with a shape fingerprint on 0 mapped rows so drift shows in the cron report.
- The same hackathon can arrive from two sources (e.g. MLH + Hack Club) as two rows —
  dedupe is per-source URL only. Known trade-off; revisit if it gets noisy.
- Exposing the `hackathon` schema to the Data API needs the platform config **and** the
  `authenticator` role's `pgrst.db_schemas` + both `notify pgrst` reloads — see the
  "Data API exposure" section in root `SCHEMA_RULES.md` (this bit Event Radar's first
  cron run with `Invalid schema: hackathon`).
- Enrichment throughput is capped by two ceilings, not by choice: Vercel Hobby's 60s
  `maxDuration`, and the free LLM RPM limits (~30/min Groq, ~15/min Gemini). The runner
  self-budgets to 50s and enriches `ENRICH_BATCH` (30) rows per run in
  `ENRICH_CONCURRENCY` (4) parallel chunks — raise those only together and only after
  checking both ceilings, or you'll trip 429s. A row whose page can't be fetched
  (EthGlobal SPA, WAF blocks) falls back to enriching from title+location metadata so it
  doesn't clog every batch; a row with neither page nor metadata stays pending for a retry.
- Cadence: Vercel Hobby cron = once/day max (the `vercel.json` daily floor). A free
  GitHub Actions workflow (`.github/workflows/event-radar-ingest.yml`) adds 3 more runs
  (every 6h ≈ 4x/day) by calling the same `/api/cron/ingest` endpoint. It needs the repo
  secret `EVENT_RADAR_CRON_SECRET` = the project's `CRON_SECRET`.
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

Throughput/cadence session (2026-07-18):
- Applied migration 0002 (Apply Kit unblocked); backlog drained to 106/113 enriched by
  hammering the production cron (7 stuck rows were the EthGlobal SPA + 3 MLH — the
  metadata-fallback above now handles that class).
- Enrichment parallelized (batch 10→30, concurrency 4) and a 4x/day GitHub Actions cron
  added. **Not yet on `main`** — on branch `claude/hackathon-auto-apply-tool-hg8cwv`,
  pending Ignas's merge.

Sources-expansion session (branch `claude/hackathon-sources-allowlist-ldf02w`):
- **Three new JSON-API sources: Unstop, Devfolio, DoraHacks** (`lib/ingest/{unstop,devfolio,
  dorahacks}.ts`), wired into `run.ts` (now 8 sources). Field mappings were reverse-
  engineered from each platform's public endpoint and covered by `test/new-sources.test.ts`
  (5 tests, all green; typecheck + lint clean).
- **Not live-verified** — every candidate domain 403s to interactive-session egress and to
  WebFetch, so counts can only be confirmed via the per-source production cron report after
  merge. Each `fetch*` throws a shape fingerprint on 0 rows, so drift is self-reporting.

## Next

- **Ignas, before the GH cron works:** add repo secret `EVENT_RADAR_CRON_SECRET` (=
  project `CRON_SECRET`) at repo Settings → Secrets → Actions. Until then the workflow
  fails fast with a clear message; the daily Vercel cron is unaffected.
- **Verify the three new sources (Unstop/Devfolio/DoraHacks) in production.** They were
  added blind (all candidate domains still 403 interactive-session egress + WebFetch, even
  after the allowlist change — that allowlist only reaches the cloud/cron egress). After
  this branch merges, read the per-source cron report (`/api/cron/ingest` JSON or the
  owner-only Settings refresh) and confirm each returns a count, not an `error:`/`0 events
  mapped` fingerprint. If a shape drifted, the throw message names which field to fix.
- **Remaining source candidates (still blocked on egress):** Taikai (EU/global, GraphQL),
  Hackathon.com (aggregator). Same path — reverse-engineer the shape, add blind, verify via
  cron report.
- The strict eligibility rule can produce an empty feed when sources have no row with
  both a future start and future registration deadline. Use the manual Settings refresh
  to inspect source counts before relaxing the fail-closed rule.
- Ignas: install the PWA on the Pixel, log in, test push end-to-end (say the word and the
  next-agent can clear a couple `notified_at` flags + trigger the cron to fire a real one).
- Roadmap (per EVENT_RADAR_PLAN.md): approval-gated auto-fill via Claude Code cloud
  sessions, night search agents, more EU travel-reimbursing sources.
