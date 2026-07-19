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
- **Online events get zero points** from the travel/location section. Being online is
  neutral, not a bonus. We prioritise confirmed travel-covered in-person events and
  strong eligibility signals.
- Feed and notification eligibility (`isUpcomingAndOpen` in `lib/scoring.ts`) is
  **fail-closed** for most sources: both `starts_at` and `registration_deadline` must
  parse as valid timestamps and must be strictly later than now. Missing, malformed,
  already-started, or closed-registration rows never qualify.
  **Luma exception:** the discovery API never supplies a registration deadline (RSVPs
  stay open until the event starts). For `source === 'luma'` with a null deadline, a
  strictly future `starts_at` is enough to qualify.
- **Travel ✓ filter** = only `travel_covered === true` (confirmed reimbursement).
  Online is a separate filter.
- Enrichment (`lib/ingest/enrich.ts`): Groq `llama-3.3-70b-versatile` primary (high-volume
  structured extraction per root CLAUDE.md model guidance), Gemini Flash fallback, and a
  hard rule that a failed extraction leaves fields `null` ("unknown") — never guessed.
- Ingest sources return `IngestRow[]` and throw on total failure; the cron reports
  per-source errors in its JSON response instead of dying (check the Vercel cron logs).
  Seven sources: devpost, mlh, ethglobal, hackerearth, hackclub, luma, hackquest
  (`lib/ingest/*.ts`). **Domain/source status is tracked in `SOURCES.md`**.
  `IngestRow.registration_deadline` is optional — ETHGlobal and HackQuest provide it;
  enrichment fills it elsewhere and never overwrites a source-provided value. Luma never
  provides one (handled by the eligibility exception above).
- The shared server runner (`lib/ingest/run.ts`) owns gather/enrich/notify. Newly inserted
  rows are enriched in the same run (priority), and rows that still have critical nulls
  (`format` / `travel_covered`) are also retried. The scheduled cron calls it with
  notifications enabled; the owner-only manual route (`POST /api/ingest/refresh`) calls
  it with notifications disabled.
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
`0002_apply_kit.sql` both **applied 2026-07-18** via the Management API. 0002 adds:

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
- Luma: `api.lu.ma/discover/get-paginated-events?query=hackathon` is a public,
  no-auth, cursor-paginated feed. The query is **fuzzy** — it returns some non-hackathon
  meetups, so `parseLumaPage` keeps only name-matched entries. Format detection is
  aggressive: any useful geo data → `in_person`. Do NOT use `api.lu.ma/search/get-results`
  (401, signed-in only). The entry `url` is a bare slug → the page is `lu.ma/<slug>`.
  Luma never supplies `registration_deadline`; eligibility special-cases it.
- HackQuest: GraphQL introspection is **disabled**, so `lib/ingest/hackquest.ts`
  hard-codes the `getAllHackathonInfo` operation lifted from the site bundle and
  POSTs it to `api.hackquest.io/graphql` (no auth). Map only `status:"publish"`
  rows; it provides an exact `registrationClose` → passed through as
  `registration_deadline` (like ETHGlobal). Detail page: `www.hackquest.io/hackathon/<alias>`.
- The same hackathon can arrive from two sources (e.g. MLH + Hack Club) as two rows —
  dedupe is per-source URL only. Known trade-off; revisit if it gets noisy.
- Enrichment throughput is capped by two ceilings: Vercel Hobby's 60s `maxDuration`, and
  free LLM RPM limits. The runner self-budgets to 50s and enriches up to 30 rows per run
  in concurrency 4. Newly inserted rows are prioritised; rows that still have critical
  nulls are also retried.
- Cadence: Vercel Hobby cron = once/day max. A free GitHub Actions workflow adds 3 more
  runs (every 6h ≈ 4x/day). Needs repo secret `EVENT_RADAR_CRON_SECRET`.
- Push payload URLs must stay relative (`'/'`) — iron rule #1.
- `sendPush` returns `'gone'` for 404/410 → the cron deletes those subscription rows.
- iOS requires the PWA to be installed to home screen before push permission can be asked.

## Current state

**Live in production** — ships from `main`.

Recent changes (2026-07-19):
- Removed the +35 Online score bonus entirely. Online is now neutral.
- Travel ✓ filter tightened to only `travel_covered === true`.
- Luma format detection made aggressive (any useful geo → in_person).
- Enrichment now prioritises newly inserted rows in the same run and retries rows that
  still have critical nulls (format / travel_covered).

## Next

- Trigger a manual refresh and verify that in-person Luma events (London, Dubai, etc.)
  are no longer mis-tagged as Online and that the Travel filter only shows confirmed
  travel-covered events.
- Watch enrichment success rate on the new priority queue.
- Add repo secret `EVENT_RADAR_CRON_SECRET` so the 4×/day GitHub Actions workflow works.
- Re-probe Topcoder / Junction / Hackster from production egress.
- Roadmap: more EU travel-reimbursing sources, approval-gated auto-fill, night agents.
