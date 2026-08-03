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
  Hidden from the main feed until registration is open — that gate lives **inside
  `isUpcomingAndOpen`** (dormant rows require a real future registration deadline), NOT
  as a second `!isDormantCircuit(h)` filter in `Feed.tsx`. That extra filter used to hide
  reopened circuits outright: PennApps was travel-covered and three weeks from closing
  while reachable only via the Dormant tab. Removed — an open dormant circuit now appears
  in the main feed *and* the Dormant tab.
  Weekly GH Action (`event-radar-dormant-weekly.yml`) probes sites, opens a GitHub
  issue with candidates + parsed deadlines; high-confidence can auto-commit
  `promoted-from-dormant.json`.
- **Travel ✓ filter** = `travelUsefulForMe(h, home_base) === 'yes'` (via `hasUsefulTravel`
  in `lib/digest.ts`) — i.e. exactly the events wearing the solid purple **Travel** tag.
  A bare `travel_covered === true` with no geography is only *maybe* and does NOT pass:
  filter, card tag, and digest count all share this one predicate so they can never
  disagree. Online is a separate filter.
- **The registry carries verified travel POLICY, not just a boolean**
  (`travelPolicy` on `TravelPriorityCircuit`, applied via `circuitTravelPolicy`).
  A bare `travel_covered = true` can never reach `travelUsefulForMe === 'yes'` —
  that needs geography — so Tier A circuits sat permanently at "Travel · check
  FAQ" and the Travel filter matched **0 of 555** catalog rows. The scope was
  meant to come from enrichment, but the flagship circuit sites are JS shells
  (probe measured hackmit 2 words, pennapps 2, hackthenorth 3, bitcamp 1,
  hackgt 2, technica 1), so enrichment was being asked for a fact its input
  never contained. Fill `travelPolicy` **only from wording someone read** —
  every entry carries its `quote` and `verifiedOn`. Precedence is
  **page extraction > registry > nothing**; a verified `scope: 'none'` also
  overrides the tier prior (hackaTUM and McHacks both say outright they do not
  reimburse). `lib/ingest/travel-policy-backfill.ts` applies the registry to
  rows that are already enriched — they are never re-enriched, so without it a
  policy added today would only reach events inserted tomorrow.
- **Travel-priority tiers drive the prior honestly** (`circuitTravelCovered`): only
  **Tier A** (documented reimbursement) sets `travel_covered = true` up front. **Tier B**
  (unclear / winner-only / region-gated / monitor) returns `null` — being on the list is
  not evidence; the FAQ crawl + LLM must confirm travel per edition. Add a circuit as Tier A
  only with hard evidence; otherwise Tier B.
  **Evidence path for EU circuits:** every EU hackathon domain is blocked by the sandbox
  egress policy, so a Claude/Codex session *cannot* produce Tier A evidence for them. The
  weekly watch-agent (`event-radar-watch-agent.yml`, Mondays 08:00 UTC) runs
  `scripts/probe-travel-priority.mjs` from GitHub's open egress and reports
  `travel_language` / `reg_open_language` per circuit — that report (or a production
  enrichment run) is what promotes an EU circuit from B to A. Keep the script's circuit
  list in sync with `lib/travel-priority*.ts`.
  The registry was NA-heavy (20+ Tier A in North America vs 3 in Europe); EU entries added
  2026-07-26 — hackaTUM, Hack Cambridge, CASSINI, EDTH — sit at **Tier B pending that probe**.
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
- **Luma queries rotate; they do not all run every sweep**
  (`lib/ingest/luma-rotation.ts`). The region packs grew to ~150 queries × up to
  2 pages, fired back to back, and Luma rate-limits after roughly 40 requests —
  after which `fetchLumaQuery` treated every 403 as "no more pages" and moved
  on. The tail of the list never ran, which is why the live catalog was full of
  California/UK/India/Germany and had **zero** rows from France, Spain,
  Portugal, the Netherlands, Belgium, Poland, Lithuania, Czechia, Hungary or
  Italy despite all of them being queried on paper. Now: a window of
  `LUMA_WINDOW` (35) per sweep, stepped a whole window per 3-hour slot, paced
  250ms apart, abandoning the run after `BLOCKED_STREAK_LIMIT` consecutive
  rate-limited queries. ~5 ingest runs/day cycles the list about twice daily.
  **Adding a query is therefore cheap** — it joins the rotation instead of
  pushing another one off the end. `summary.luma_queries`
  (`ok`/`blocked`/`failed`) makes the limiter visible in the cron report; a
  persistently high `blocked` means lower the window, not add retries.
- Feed (`components/Feed.tsx`) fetches the newest **1000** catalog rows then filters with
  `isUpcomingAndOpen` client-side. Raise this before the catalog outgrows it, or move the
  future-start filter server-side (the limit is applied *before* eligibility filtering).
- Ingest sources return `IngestRow[]` and throw on total failure; the cron reports
  per-source errors in its JSON response instead of dying (check the Vercel cron logs).
  Sources: devpost, mlh, ethglobal, hackerearth, hackclub, luma, hackquest, devfolio,
  taikai, dorahacks, startuplithuania, allhackathons, hacktrack (`lib/ingest/*.ts`),
  plus known/watch.
  **Domain/source status is tracked in `SOURCES.md`**. (Topcoder was removed — it
  threw on every production sweep and is low-value for a travel/in-person radar.)
  `IngestRow.registration_deadline` is optional — ETHGlobal and HackQuest provide it;
  enrichment fills it elsewhere and never overwrites a source-provided value. Luma never
  provides one (handled by the eligibility exception above).
- The shared server runner (`lib/ingest/run.ts`) owns gather/enrich/notify. Newly inserted
  rows are enriched in the same run (priority), and rows that still have critical nulls
  (`format` / `travel_covered`) are also retried. Chunked `.in()` queries for DB stability.
  The scheduled cron calls it with notifications enabled; the owner-only manual route
  (`POST /api/ingest/refresh`) calls it with notifications disabled.
- **Daily digest, not per-event pushes** (`lib/digest.ts`, notify phase of `run.ts`):
  at most **one push per user per day** summarising what appeared —
  title `"5 new hackathons"`, body `"3 IRL · 2 multi-day · 1 travel covered"`.
  - **Suppressed unless something qualifies:** an event only counts if it is IRL,
    multi-day, or travel-covered (`qualifiesForDigest`). No qualifiers ⇒ no push at all
    (`buildDigestPayload` returns `null`) — a pile of online one-evening jams never buzzes.
  - The user's `min_score` still applies first; the tag gate is on top of it.
  - Counts **overlap by design** (one IRL multi-day travel event counts in all three) —
    they answer "how many have this property", they are not a partition of the total.
  - `isIrlEvent` is stricter than the feed's IRL tab: only known `in_person`/`hybrid`,
    never unknown-format, so "3 IRL" in a notification is literally true.
  - Once-per-day gate = `DIGEST_MIN_GAP_HOURS` (**20h**, not 24h): the cron fires at
    05:00 UTC ±59min plus ~4 GH Action runs, so a strict 24h gate would silently skip a
    day on jitter (05:59 → 05:01 = 23h02m). Bad/missing timestamps **fail open**.
  - The digest is only "burned" (clock stamped + rows marked) when a push **actually
    landed** — missing VAPID keys (`'unconfigured'`) or a transient failure roll the
    whole batch into the next run instead of silently eating a day's events.
  - `notified_at` = "already accounted for in a digest". It is stamped on **every**
    considered row (including non-qualifiers) but **only when a digest actually went
    out** — otherwise events accumulate for the next one. Marking non-qualifiers keeps
    the newest-first candidate window from silting up with permanent non-qualifiers.
    `notified_at` is global, not per-user (single-user app — same as the old behaviour).
- **"New" tag** (`isNewHackathon`, `NEW_BADGE_HOURS` = 72): blue badge on cards for
  recently ingested rows, driven by `created_at` — the visual counterpart to the digest.
- Manual refresh authorization is checked against the verified Supabase user email via
  `lib/owner.ts`; `EVENT_RADAR_ADMIN_EMAIL` can override the portfolio-owner default.
- Global `hackathons` writes use the service-role client (`lib/supabase/admin.ts`). RLS has
  a select-only policy for authenticated users; no other browser or API path gets admin
  access.
- Per-user tables (`user_hackathon_status`, `user_preferences`, `push_subscriptions`)
  are written from the browser client or a cookie-authed route; RLS scopes rows to `auth.uid()`. No service role outside the shared
  ingest runner.
- Notes ride on the `user_hackathon_status` row (status is NOT NULL): saving a note with
  no status starts one at `interested`; clearing a status deletes the row, notes included.
- **Feed UI filters** (`components/Feed.tsx`):
  - IRL ↔ Online: mutually exclusive switch
  - Multi-day: independent on/off toggle (`durationHours > 24`)
  - Travel: independent on/off toggle — confirmed-useful travel only (see above)
  - Applied / Dormant / New: override lists — ignore format + multi-day + travel
  - **New tab** (`lib/new-arrivals.ts`, chip shows a live count): everything
    ingested within `NEW_BADGE_HOURS` (72h), newest arrival first. It is the
    one list that **deliberately skips `isUpcomingAndOpen`** — a row ingested
    minutes ago has no `registration_deadline` yet (enrichment fills it on a
    later pass) and the feed is fail-closed on that, so requiring eligibility
    would leave the tab empty in exactly the minutes after a refresh when you
    open it. Only the unknown-deadline gate is relaxed: already-started events
    are still dropped, hidden rows stay hidden, and sorting is by arrival, not
    score. Shares `isNewHackathon` with the card's blue New badge, so count,
    list and badges can never disagree.
  - `status === 'applied'` and `status === 'hidden'` are **excluded from main feed**
    (Applied only in Applied tab; hidden nowhere)

## Data model

Schema `hackathon` (additive-only forever). Migrations `0001_init.sql` and
`0002_apply_kit.sql` both **applied 2026-07-18** via the Management API.

**0002's tables are retired but NOT dropped.** The Apply Kit feature (application
profile + AI-drafted answers) was scratched entirely; all of its code is gone.
The tables stay because iron rule #2 is additive-only forever — dropping them
would break any older client still running, and the migration file is the record
of what was actually applied to the database. Do not "clean these up":

- `application_profiles` — PK `user_id`, `profile` jsonb, RLS own-rows. Unused.
- `application_drafts` — PK `(user_id, hackathon_id)`, `questions`/`answers`
  jsonb, `model` text, RLS own-rows. Unused.

From 0001:

- `hackathons` — global catalog. `unique (source, url)`; enrichment-owned columns
  (`travel_covered`, `accommodation_covered`, `open_to_business_students`, `format`,
  `city`, `country`, `registration_deadline`, `raw_description`) + `enriched_at`,
  `notified_at` markers.
- `user_hackathon_status` — PK `(user_id, hackathon_id)`, status
  `interested|applying|applied|hidden`, optional `notes`.
- `user_preferences` — `filters` jsonb (reserved), `notification_settings` jsonb
  (`{enabled, min_score, priority_countries: string[], home_base, last_digest_at}`,
  default threshold 60). `last_digest_at` is **state, not a preference** — it rides in
  the jsonb so the once-per-day digest gate needs no migration; `coerceNotificationSettings`
  preserves it so saving from the settings UI can't wipe the clock.
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
- **allhackathons.com** (`lib/ingest/allhackathons.ts`): Bootstrap job-board
  template — cards are `<!-- Job -->` blocks; dates are Django's AP-style `N`
  filter ("Sept. 12, 2026", but "March"/"April"/"May"/"June"/"July" spelled out
  with no period); the country is the **tail text** of the themes footer, after
  the theme anchors. The `tr.` subdomain uses the same template with Turkish
  month names, which `parseListDate` deliberately does NOT parse — a null start
  is dropped by the fail-closed feed rather than guessed. Supplies no
  registration deadline. Adds a second row for events already ingested
  elsewhere (dedupe is by URL alone) — the known aggregator trade-off.
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
- **Luma's discover search is fuzzy about PLACE, not just name.** "hackathon
  Paris" returns London and Berlin events; "hackathon France" returned one in
  Argentina; "hackathon Lisbon" returned San Francisco. This is harmless for
  ingest — a row's location always comes from the event's own geo, never from
  the query — but it means **a query's hit count is not evidence the query
  works**. When judging whether to keep a city query, check the hits' own geo.
  The umlaut matters too: "Zürich" found a Swiss event that plain "Zurich" missed.
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
- **Dedupe is by URL ALONE, not `(source, url)`** — despite the table's unique constraint
  being `(source, url)`. The pre-insert filter in `run.ts` checks `.in('url', …)` with no
  source, so **the first source to claim a URL owns that row forever**. Aggregators (MLH,
  Devpost) usually win the race and often carry no registration deadline, and eligibility
  is fail-closed → the event is invisible in the feed permanently.
  This silently defeated the `known`/`watch` seeds, whose entire job is to supply
  hand-verified deadlines for Tier A travel circuits: Hack the North and HackRice sat in
  the catalog as MLH rows with `registration_deadline = null`, and BigRed//Hacks with a
  long-past one — none could ever appear. **Fix: `lib/ingest/seed-upgrade.ts`** — a
  colliding `known`/`watch` seed now *upgrades* the existing row (fills a missing/stale
  deadline, fills `format`/`location_raw` only when null) instead of being dropped. It
  never overwrites a valid future deadline from the real source. Count surfaces as
  `seed_patched` in the ingest summary.
  Two rows for one event can still happen when the sources use different URLs. Known
  trade-off; revisit if it gets noisy.
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
- **Startup Lithuania** live as an ingest source (`startuplithuania`), name-filtered to
  hackathons (incl. "-athon" names like Portathon), dates parsed from detail pages with
  publish-date year inference. Merged to `main` (PR #65); 1 upcoming (Portathon 2026,
  Sep 25–27, Klaipėda) — new editions auto-ingest as published.
- **Topcoder removed** — it threw on every production sweep (sole cause of the persistent
  "Refresh finished with errors" banner) and was low-value for a travel/in-person radar.
- **Daily digest replaces per-event pushes** — ≤1 push/user/day, counts of IRL /
  multi-day / travel, suppressed when nothing new carries one of those tags.
- **New tag** (blue, 72h) on freshly ingested cards; **Travel filter chip** in the feed.
- **HackZurich is on hiatus** (verified 2026-07-26 — site says so outright). It is in
  `DORMANT_TIER_A`, not a scraper blind spot; nothing to ingest until organisers return.
- **EU travel circuits widened**: hackaTUM, Hack Cambridge, CASSINI, EDTH at Tier B, all
  wired into the weekly open-egress probe. EDTH matters immediately — its editions already
  reach the catalog via Luma, so they now carry a travel prior instead of nothing.

- **Two visibility bugs fixed** (found 2026-07-26 by querying the live catalog via
  the Management API — worth doing again when "why isn't X showing?" comes up):
  seed-vs-aggregator URL collisions, and dormant circuits double-filtered out of the feed.
  Both hid *travel-covered Tier A events with open deadlines*. **Verified in the live
  catalog: the fix worked** — Hack the North, HackRice and BigRed//Hacks all carry
  deadlines now and pass `isUpcomingAndOpen`.
- **Travel filter fixed (the third gate).** The events above were in the main feed all
  along; what was broken was the **Travel chip**, which requires
  `travelUsefulForMe === 'yes'` and so matched **0 of 555** rows — only 2 rows in the
  whole catalog had a `travel_scope` and none had a region. Root cause was not the
  extractor: the circuit sites are JS shells with 1–3 words of text, so enrichment
  never had anything to read (their `raw_description` is 9–61 chars). The registry now
  stores verified policy (see Conventions), and a backfill pass repairs already-enriched
  rows each run (`policy_backfilled` in the summary). Six circuits carry evidence:
  HackUPC (international, EU-inclusive, ~€120), TreeHacks (global), YHack + ConUHacks
  (selective), McHacks + **hackaTUM** (explicitly none — hackaTUM was queued as the
  likeliest B→A promotion and the probe showed the opposite).
- **EU coverage: the region packs now actually execute.** The gap was an
  execution bug, not missing queries — see the rotation note in Conventions.
- **EU west/south pack added** (`lib/region-eu-west-south.ts`): France, Spain,
  Portugal, Ireland, Switzerland, Greece/Cyprus/Malta, Romania/Bulgaria, the
  Balkans, Luxembourg/Iceland — none of which had any coverage. **On-target**
  yield (paced re-run, 2026-07-26): **Ireland 3** (Dublin ×2, Galway),
  **Switzerland 2** (Winterthur/Zürich, Leukerbad), **Spain 1** (Barcelona).
  Everything else measured 0 for July, including the Balkans and small states —
  those ran properly on the paced re-run, so 0 is real, not a rate-limit
  artifact.
- **HackTrack EU live as an ingest source** — public JSON, EU-shaped by
  construction, 28 countries in its archive including the eight the catalog had
  zero rows for (Malta, Bulgaria, Croatia, Slovakia, Serbia, Cyprus, Luxembourg,
  Iceland). Off-season its `upcoming` list is near-empty; that is the European
  calendar, not a fault, so it never throws on zero.
- **New tab** in the feed — see Feed UI filters.
- **allhackathons.com live as an ingest source** — server-rendered international
  listing, the one aggregator that survived the open-egress probe.
- **Turkey groundwork** (`lib/region-turkey.ts`): Türkiye/İstanbul spellings recognised,
  Turkey → europe travel region, `priority_countries: ['turkey']` now matches a
  "Türkiye"-labelled event (it never did — `matchesCountry` is a plain substring test),
  Luma TR queries wired, organiser watch list recorded.

## Next

- **Hit Refresh once after deploy.** Two repairs only land on a run: the seed upgrade
  (Hack the North / HackRice / BigRed//Hacks — already confirmed applied in production)
  and the new travel-policy backfill. Check `policy_backfilled` in the response.
- **The Travel chip will show ~2 events, not 21.** That is honest, not broken: only
  HackUPC and TreeHacks have wording that covers a Baltic traveller. The other 19
  travel-covered events are real but their geography is unverified, so they stay
  "Travel · check FAQ". **Open product question for Ignas:** should the Travel chip
  include those `maybe` events (one chip, looser) or stay strict? Changing it also
  changes the card tag and the digest count — they deliberately share one predicate.
- **Watch `luma_queries` in the next few cron reports.** `blocked` should be 0
  or low. If it stays high, drop `LUMA_WINDOW` below 35 — do not add retries,
  the limiter is per-window not per-request.
- **Best untapped EU hub is Codemotion** (`events.codemotion.com`) — claims 500+
  European tech events and server-renders some of them. Probe its markup, then
  parse. Second cheapest win: pass `challenge_type[]=in-person` to the Devpost
  API, which it supports and `devpost.ts` does not use.
- **Two events share the name UNIHACK** — `unihack.eu` (Timișoara, Romania) and
  `unihack.net` (Australia). Only the Romanian one has a verified policy
  ("No, we cannot cover your travel costs"); the registry entry is host-anchored
  and its title pattern requires Romanian context so it can never claim the
  Australian row by name. Watch for this shape when adding circuits.
- **Grow the verified registry** — that is what moves the Travel chip. The weekly
  watch-agent probe now prints the actual policy sentences (not just a boolean), so
  promoting a circuit is a matter of reading the run log and adding a `travelPolicy`
  with its quote. Best remaining candidates: CASSINI (799 words, no travel language
  found yet), Hack Cambridge (198 words), LA Hacks / MHacks (FAQ accordions hide the
  answer behind JS), EDTH (unreachable — retry).
- **Turkey is closed as a research question.** It is an absence, not a blockage: from
  open egress, Luma returns 0 for Istanbul/Ankara/Turkey/Türkiye, hackathon.com has no
  upcoming Turkey (or Germany) events, and every Turkish event on tr.allhackathons.com
  is past. Two corrections to the earlier note: **dev.events is unusable** (Cloudflare
  403 even from a GitHub runner, not an allowlist issue), and the **Turkish Airlines
  Travel Hackathon is not upcoming** — "22 Aralık" is the **2017** edition, and
  `hackathon.turkishairlines.com` does not resolve. The monthly *Event Radar Turkey
  source probe* workflow re-checks all of it; nothing more to do until it reports a
  live event.
- First digest fires on the next cron run after deploy; check the cron JSON's `digest`
  field (`sent` / `gated` / `nothing_new` / `nothing_qualified`) if a buzz is unexpected.
- If digests feel too rare, the likely cause is `min_score` (default 60) filtering
  candidates out before the tag gate — lower it in Settings rather than loosening the gate.
- Verify latest deploy on Vercel (Hobby deploy quota may delay). No open code bugs known;
  remaining work is product polish + enrichment quality.
- Confirm Applied-only-in-Applied-tab after deploy; hard-refresh PWA if stale.
- Watch dormant weekly GH issue for first promote candidates; review high-confidence
  auto-promotes if any.
- Optionally tighten Ignored Build Step on non-event-radar Vercel projects to save
  the 100 deploys/day quota.
- Re-probe Junction / Hackster from production egress if needed (Topcoder tried & removed).
- Roadmap: more EU travel-reimbursing sources, night agents. (Application
  auto-fill/Apply Kit was scratched — see Data model for why its tables remain.)
