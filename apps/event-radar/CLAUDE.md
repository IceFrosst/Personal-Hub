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
- Extra cadence: GitHub Actions workflows under `.github/workflows/event-radar-*.yml`
  (ingest, probe, watch-agent, dormant-weekly, baltic/priority-country weekly)

## Conventions

- Score is **computed at read time** (`lib/scoring.ts`), never stored — re-weighting is a
  code change, not a migration. The same function runs in the feed (client) and the notify
  phase (server); keep them identical.
- **Online events get zero points** from the travel/location section. Being online is
  neutral, not a bonus. We prioritise confirmed travel-covered in-person events and
  strong eligibility signals.
- Scoring boosts (approx): travel_covered +30–50, travel tier A +8, priority_countries +30,
  multi-day (>24h) +25, accommodation +20, open_to_business_students +15, big prize pool +5.
  Defaults for `priority_countries` come from cheap RT flights from Lithuania (<~70€):
  LT/LV/EE + PL, FI, DE, NL, SE, DK, NO, IT, CZ, UK, BE, AT, HU, GE (see flight screenshots
  in conversation history / settings defaults in types).
- Feed and notification eligibility (`isUpcomingAndOpen` in `lib/scoring.ts`) is
  **fail-closed** for most sources: both `starts_at` and `registration_deadline` must
  parse as valid timestamps and must be strictly later than now; feed also requires
  **≥7 days** until start. Missing, malformed, already-started, or closed-registration
  rows never qualify.
  **Luma exception:** the discovery API never supplies a registration deadline (RSVPs
  stay open until the event starts). For `source === 'luma'` with a null deadline, a
  strictly future `starts_at` is enough to qualify.
- **Dormant circuits** (`lib/dormant-tier-a.ts`): TreeHacks, PennApps, HackUPC, etc.
  Hard-hidden from main feed via `isDormantCircuit` until registration is open.
  Weekly GH Action (`event-radar-dormant-weekly.yml`) probes sites, opens a GitHub
  issue with candidates + parsed deadlines; high-confidence can auto-commit
  `promoted-from-dormant.json`.
- **Travel ✓ filter** = only `travel_covered === true` (confirmed reimbursement).
  Online is a separate filter.
- **Travel-priority tiers drive the prior honestly** (`circuitTravelCovered`): only
  **Tier A** (documented reimbursement) sets `travel_covered = true` up front. **Tier B**
  (unclear / winner-only / region-gated / monitor) returns `null` — being on the list is
  not evidence; the FAQ crawl + LLM must confirm travel per edition. Add a circuit as Tier A
  only with hard evidence; otherwise Tier B.
- **India rule is travel-gated, not a blanket block** (`isIndiaFocused` in `scoring.ts`):
  India-focused events (Unstop source, India location, "Smart India"…) are hidden from feed
  and scored −100 **unless `travel_covered === true`**. A fully-covered Indian event
  (e.g. ETHIndia, Tier A) surfaces; local-only ones stay hidden. Ignas will travel to India
  for a covered event.
- Enrichment (`lib/ingest/enrich.ts`): Groq `llama-3.3-70b-versatile` primary (high-volume
  structured extraction per root CLAUDE.md model guidance), Gemini Flash fallback, and a
  hard rule that a failed extraction leaves fields `null` ("unknown") — never guessed.
- **Second-hop travel/FAQ crawl (`fetchBestPageText` in `run.ts`):** the listing page
  rarely states travel policy, so enrichment also reads FAQ pages. Two sources of extra
  URLs: registry circuits' `circuitFaqPaths`, and — for the general population —
  `genericTravelFaqUrls`, which probes `/faq · /travel · /logistics` on the event's own
  origin **only for non-online, organizer-hosted events** (aggregator hosts like lu.ma /
  devpost / hackquest are skipped — their page isn't the organizer's). Total extra fetches
  are capped at 4 with a 5s timeout each. Limitation: plain fetch can't read JS-only SPA
  sites (e.g. hackzurich.com returns a 46-word shell for every path); the no-headless rule
  stands, so SPA organizers stay "unknown" until their policy is server-rendered.
- Feed (`components/Feed.tsx`) fetches the newest **1000** catalog rows then filters with
  `isUpcomingAndOpen` client-side. Raise this before the catalog outgrows it, or move the
  future-start filter server-side (the limit is applied *before* eligibility filtering).
- Ingest sources return `IngestRow[]` and throw on total failure; the cron reports
  per-source errors in its JSON response instead of dying (check the Vercel cron logs).
  Sources: devpost, mlh, ethglobal, hackerearth, hackclub, luma, hackquest, devfolio,
  taikai, dorahacks, topcoder, startuplithuania (`lib/ingest/*.ts`), plus known/watch.
  **Domain/source status is tracked in `SOURCES.md`**.
  `IngestRow.registration_deadline` is optional — ETHGlobal and HackQuest provide it;
  enrichment fills it elsewhere and never overwrites a source-provided value. Luma never
  provides one (handled by the eligibility exception above).
- The shared server runner (`lib/ingest/run.ts`) owns gather/enrich/notify. Newly inserted
  rows are enriched in the same run (priority), and rows that still have critical nulls
  (`format` / `travel_covered`) are also retried. Chunked `.in()` queries for DB stability.
  The scheduled cron calls it with notifications enabled; the owner-only manual route
  (`POST /api/ingest/refresh`) calls it with notifications disabled.
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
- **Feed UI filters** (`components/Feed.tsx`):
  - IRL ↔ Online: mutually exclusive switch
  - Multi-day: independent on/off toggle (`durationHours > 24`)
  - Applied / Dormant: override lists — ignore format + multi-day
  - `status === 'applied'` and `status === 'hidden'` are **excluded from main feed**
    (Applied only in Applied tab; hidden nowhere)

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
  `interested|applying|applied|hidden`, optional `notes`.
- `user_preferences` — `filters` jsonb (reserved), `notification_settings` jsonb
  (`{enabled, min_score, priority_countries: string[]}`, default threshold 60).
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
  no-auth, cursor-paginated feed. Expanded with city queries for priority regions
  (`lib/region-priority-batch1..4.ts`, Baltic/PL helpers). The query is **fuzzy** —
  keep only name-matched hackathons. Format detection is aggressive: any useful geo →
  `in_person`. Do NOT use `api.lu.ma/search/get-results` (401). Entry `url` is a bare
  slug → page is `lu.ma/<slug>`. Luma never supplies `registration_deadline`.
- HackQuest: GraphQL introspection is **disabled**, so `lib/ingest/hackquest.ts`
  hard-codes the `getAllHackathonInfo` operation lifted from the site bundle and
  POSTs it to `api.hackquest.io/graphql` (no auth). Map only `status:"publish"`
  rows; it provides an exact `registrationClose` → passed through as
  `registration_deadline` (like ETHGlobal). Detail page: `www.hackquest.io/hackathon/<alias>`.
- Startup Lithuania (`lib/ingest/startuplithuania.ts`): WP REST `cpstart_events` gives a
  reliable event list but **no structured date** (ACF not exposed; `date` is the publish
  time). The event date is only in the detail page's `single-article__title` as a **yearless**
  `listing__date` ("Nov 24, 10:00 - Nov 28, 16:00"). The source fetches each hackathon's
  detail page and infers the year by anchoring to the REST publish date (event is published
  shortly before it runs) — so past editions resolve to the past and fail-closed drops them
  instead of inventing fake future events. Name-filtered to hackathons; 0 upcoming is a
  legitimate empty (it throws only if the REST endpoint returns 0 events at all).
- The same hackathon can arrive from two sources (e.g. MLH + Hack Club) as two rows —
  dedupe is per-source URL only. Known trade-off; revisit if it gets noisy.
- Enrichment throughput is capped by two ceilings: Vercel Hobby's 60s `maxDuration`, and
  free LLM RPM limits. The runner self-budgets to 50s and enriches up to 30 rows per run
  in concurrency 4. Newly inserted rows are prioritised; rows that still have critical
  nulls are also retried.
- Cadence: Vercel Hobby cron = once/day max. GitHub Actions add more runs (ingest ~4×/day,
  dormant weekly, priority-country probes). Needs repo secrets as documented in workflows.
- **Vercel Hobby: 100 deployments/day account-wide.** Monorepo has 4 Vercel projects;
  every push can burn 4 deploys. Prefer `DEPLOY_STAMP.txt` sparingly; set Ignored Build
  Step on unused projects so only event-radar rebuilds when its files change.
- Push payload URLs must stay relative (`'/'`) — iron rule #1.
- `sendPush` returns `'gone'` for 404/410 → the cron deletes those subscription rows.
- iOS requires the PWA to be installed to home screen before push permission can be asked.
- `turbo.json` lists secrets under `globalEnv` so Turbo does not strip them at build.

## Current state

**Live on main** — production ships from `main` to `icefrosst-event-radar`.

- Feed filters: IRL ↔ Online switch, Multi-day on/off, Applied tab, Dormant tab.
- Applied + Hidden excluded from main feed (Applied only under Applied).
- Dormant Tier A circuits hard-hidden until reg open; weekly probe → GH issue +
  optional auto-promote JSON.
- Priority countries + multi-day (+25) scoring live; 4 phased region packs
  (`lib/region-priority-batch1..4.ts`) for PL/FI/DE/NL → SE/DK/NO/IT → CZ/UK/BE/AT → HU/GE.
- TreeHacks / PennApps etc. in dormant list, not main feed.
- India sources removed/filtered.
- **Startup Lithuania** wired in as an ingest source (`startuplithuania`), name-filtered
  to hackathons, dates parsed from detail pages with publish-date year inference. Live via
  the shared runner; currently 0 upcoming (all listed editions are past) — new editions
  auto-ingest as the site publishes them.

## Next

- **Handoff:** Startup Lithuania source added on this branch
  (`claude/startup-lithuania-events-pcl0f0`) — tests + typecheck + lint green, verified
  live (5 hackathons matched & date-parsed, all past → 0 upcoming). Merge to `main` to
  deploy; re-check after a real upcoming LT hackathon is published.
- Verify latest deploy on Vercel (Hobby deploy quota may delay). No open code bugs known;
  remaining work is product polish + enrichment quality.
- Confirm Applied-only-in-Applied-tab after deploy; hard-refresh PWA if stale.
- Watch dormant weekly GH issue for first promote candidates; review high-confidence
  auto-promotes if any.
- Optionally tighten Ignored Build Step on non-event-radar Vercel projects to save
  the 100 deploys/day quota.
- Re-probe Topcoder / Junction / Hackster from production egress if needed.
- Roadmap: more EU travel-reimbursing sources, approval-gated auto-fill, night agents.
