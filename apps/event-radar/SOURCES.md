# Event Radar — ingest source status

Tracking doc for every hackathon domain Ignas has allowlisted, and whether it
can feed the radar. Each domain was probed from a **cloud session with open
egress** (2026-07-18). Keep this live: when a source is implemented, moved to
✅; when a probe result changes, update the row and the note.

> **Egress caveat (read before trusting a ❌).** Reachability depends on session
> type. Interactive Claude Code sessions only reach allowlisted domains and many
> hackathon sites 403 through the egress proxy; cloud/scheduled sessions and
> production Vercel have open egress with different IPs. A `000`/`403` here is
> "not reachable *from this session*", not proof the feed is dead — several of
> the ❌ rows below may work from production Vercel. Re-probe before writing one
> off. Also: Node `fetch` does not use the session HTTPS proxy, so a WAF can 403
> `fetch` while proxied `curl` succeeds (HackerEarth does exactly this).

## Status legend

- ✅ **Live** — implemented as an ingest source, verified with real data.
- 🟡 **Reachable, no clean feed** — the host answers, but no usable public
  JSON/HTML feed was found without deeper reverse-engineering. Candidate for a
  future scraper.
- ❌ **Blocked / no feed here** — WAF-blocked, unreachable from this session, or
  no machine-readable event data at all.

## Matrix

| Domain(s) | Status | How it's reached / why not |
|---|---|---|
| `lu.ma` · `api.lu.ma` · `luma.com` | ✅ Live | `GET api.lu.ma/discover/get-paginated-events?query=hackathon`, cursor-paginated, **no auth**. Implemented in `lib/ingest/luma.ts` — **92 hackathons mapped live** (Austin, London, Bengaluru, São Paulo, Berlin…). Global breadth, many short community events. `luma.com` just redirects to `lu.ma`. |
| `startuplithuania.com` · `www.` | ✅ Live | WordPress site; events are the `cpstart_events` custom post type, listed via the public WP REST API (`GET /wp-json/wp/v2/cpstart_events?per_page=100`, no auth). Implemented in `lib/ingest/startuplithuania.ts` — name-filtered to hackathons (mostly conferences/meetups otherwise). REST carries no structured event date, so each hackathon's yearless `listing__date` (in the detail page's `single-article__title`) is fetched and the year inferred from the REST publish date. The hackathon filter also catches "-athon" names without "hack" (e.g. "Portathon", a 48h maritime hackathon) while excluding running/charity marathons. Lithuania = home base + top-priority country. |
| `hackquest.io` · `api.hackquest.io` · `www.hackquest.io` | ✅ Live | GraphQL introspection is disabled, so the `getAllHackathonInfo` / `listHackathons` operation was **lifted verbatim from the frontend bundle** (`_next/static` chunks) and replayed against `POST api.hackquest.io/graphql` — public, no auth. Implemented in `lib/ingest/hackquest.ts` — **111 hackathons mapped live**, all with source-provided `registration_deadline`, prizes, and ecosystem themes (Web3/AI buildathons: Injective, Arbitrum, 0G, OKX…). |
| `akindo.io` · `api.akindo.io` · `www.akindo.io` | ❌ blocked | The hackathon ("wave") listing lives on **`app.akindo.io`**, which is **not allowlisted** (`000`). The marketing site (`akindo.io`) bundle carries no listing endpoint; `api.akindo.io` is a live NestJS host but every guessed path (`/waves`, `/hackathons`, `/products/`, `/graphql`, …) 404s. **To unblock: allowlist `app.akindo.io`**, then lift its API paths the same way HackQuest was done. |
| `spaceappschallenge.org` · `www.` | ❌ no feed | Site loads (200) but is a plain marketing page — no `__NEXT_DATA__`, no JSON-LD, no API. NASA Space Apps is **one global annual event**; not worth a bespoke fragile scrape. |
| `hackjunction.com` · `www.` · `api.hackjunction.com` | ❌ here | `www` loads (200) as a SPA; `api.hackjunction.com` → `000` (DNS/network-unreachable from this session, not a WAF). Junction runs an events API — **retry the api subdomain from production Vercel egress**; if it resolves there it's implementable. |
| `kaggle.com` · `www.` | ❌ | Site 200, but `/competitions.json` → 404; listings need the **authenticated** official Kaggle API. Also: Kaggle competitions are ML contests, not really hackathons — deprioritize. |
| `topcoder.com` · `www.` | ❌ removed | Was wired up as an ingest source on the bet that `api.topcoder.com/v5/challenges` (unreachable from dev sessions, `000`/`403`) would answer from production Vercel. It doesn't — it threw on **every** production sweep, and it was the sole cause of the persistent "Refresh finished with errors" banner. Removed 2026-07-23. Low value regardless: v5 challenges are online coding contests / SRMs / gig work, not the travel-covered in-person hackathons this radar targets (online scores 0 on travel). Re-add only if a reachable, hackathon-shaped feed turns up. |
| `encode.club` · `encodeclub.com` · `www.encode.club` | ❌ (covered) | Marketing/Framer site, no event API. **Not needed** — Encode Club hackathons already surface through the Luma feed (e.g. "…London Encode Club"). |
| `angelhack.com` · `www.` | ❌ | Marketing site (301 → home), no machine-readable event feed. |
| `hackzurich.com` · `www.` | ❌ on hiatus | **Not a scraper gap — there is no event to ingest.** Verified 2026-07-26: the site serves only *"HackZurich is currently on hiatus as we evaluate future opportunities and directions for Switzerland's leading hackathon."* No 2026 edition. Previously written off here as an unscrapable SPA, which made it look like a blind spot; it isn't. Tracked in `DORMANT_TIER_A` so the weekly probe notices a return. Note the parked page also serves spam pharmacy links — treat sudden "event" content there with suspicion. |
| `gitcoin.co` · `www.` | ❌ | Next.js app; the old `/api/v0.1/hackathons` now 404s. Gitcoin has pivoted away from a hackathon list API — no clean feed. |
| `earn.superteam.fun` | ❌ | `/api/listings` redirects to `superteam.fun/api/...` which then `000`s / 404s. No working listings feed found. Re-probe if Superteam republishes the API. |
| `imaginecup.microsoft.com` | ❌ | 307 → Microsoft auth flow. No public event feed. |
| `hackster.io` · `www.` · `api.hackster.io` | ❌ | `www` → **403 (WAF)**, `api` → `000`. Same class as Devpost/MLH in interactive sessions. Retry from production egress; may need a curl-via-proxy path like HackerEarth. |

## Implemented so far

- **Luma** (`lib/ingest/luma.ts`, unit test `test/luma.test.ts`). The discover
  query is fuzzy, so the parser keeps only entries whose **name** mentions a
  hackathon / hack day / hack night / game jam, dropping near-misses like "Cafe
  Cursor". Crawls up to 4 cursor pages (~150 candidates). ~92 hackathons mapped.
- **HackQuest** (`lib/ingest/hackquest.ts`, unit test `test/hackquest.test.ts`).
  Replays the site's own `getAllHackathonInfo` GraphQL operation; maps only
  `status: publish` rows and passes through the exact `registrationClose` as
  `registration_deadline`. 111 hackathons mapped.

- **allhackathons.com** (`lib/ingest/allhackathons.ts`, unit test
  `test/allhackathons.test.ts`). Server-rendered Bootstrap listing —
  `<!-- Job -->` card blocks with badge (IN-PERSON / ONLINE), title anchor
  `/hackathon/<slug>/`, an AP-style date range ("Sept. 12, 2026 - Sept. 13,
  2026") and a country as the tail text of the themes footer. Walks up to 5
  pages, drops past events, and throws with a structural fingerprint if a page
  fetches OK but parses to zero cards. Supplies **no registration deadline**, so
  rows wait on enrichment before the fail-closed feed will show them.

- **HackTrack EU** (`lib/ingest/hacktrack.ts`, unit test `test/hacktrack.test.ts`).
  Community-run European hackathon index with a public, no-auth JSON API
  (`hacktrack-eu.vercel.app/api/hackathons?status=upcoming`), refreshed 3–4×/day.
  The first source with real breadth across the countries the catalog had
  nothing for: its archive on 2026-07-26 spanned 28 European countries —
  France 52, Switzerland 31, Ireland 11, Romania 6, Bulgaria 4, Croatia 4,
  Turkey 14, Luxembourg 1, Serbia 1 — against **15 total EU rows** the whole
  14-source catalog had for those same countries. Returns ISO country codes,
  which the source expands to names because every geography check downstream is
  a substring test (`FR` would never match `france`). Supplies no registration
  deadline, and an empty `upcoming` list is normal off-season, so it does **not**
  throw on zero — only on a malformed response.

Both are wired into `lib/ingest/run.ts` and labelled in `lib/refresh-summary.ts`.
The shared fail-closed eligibility rule (`isUpcomingAndOpen`) drops the many
already-started / closed-registration entries either source returns.

## Ruled out by the 2026-07-26 open-egress probe

Run `scripts/probe-turkey-sources.mjs` (workflow: *Event Radar Turkey source
probe*) to re-check any of these — all were tested from a GitHub runner, not the
sandbox, so these are not allowlist problems:

| Domain | Result |
|---|---|
| `dev.events` | **403 Cloudflare interstitial even from open egress.** Was the most promising lead (structured per-country listings); unusable without a headless browser, which the no-headless rule forbids. |
| `hackathon.com` | Reachable but empty — "no upcoming hackathons" for Turkey *and* Germany; the whole site's front page lists 4 events. |
| `kworks.ku.edu.tr` | CloudFront 403 to automated requests. |
| `istanbulblockchainweek.com` | Cloudflare challenge, 403. |
| `hackathon.turkishairlines.com` | Does not resolve. |
| `teknofest.org`, `t3vakfi.org`, `tubitak.gov.tr`, `bilisimvadisi.com.tr`, `itucekirdek.com`, `terminal.turkishairlines.com` | All reachable, none machine-readable — nav links and prose, no dated event lists. Tracked as a watch list in `lib/region-turkey.ts`. |
| Luma `Istanbul` / `Ankara` / `Turkey` / `Türkiye` | 0 entries each. |

Conclusion: Turkey's gap is **absence, not blockage**. Queries are wired anyway
(`LUMA_TURKEY_QUERIES`) so the net is already cast.


## EU hub candidates — probed 2026-07-26 (open egress)

Run `scripts/probe-eu-coverage.mjs` (workflow: *Event Radar coverage probe*) to
re-check. `words` is server-rendered text — a big page with almost none is a JS
shell that plain fetch cannot read.

| Site | Result |
|---|---|
| `events.codemotion.com` | **Best remaining lead.** 200, Nuxt, 293 words, advertises "more than 500 tech events for developers across Europe" and server-renders at least some entries. Needs a follow-up markup probe before writing a parser. |
| `devpost.com/api/hackathons?challenge_type[]=in-person` | 200 with real JSON — the API takes an in-person filter our `devpost.ts` does not currently pass. Cheap way to bias the sweep toward IRL events. |
| `hackjunction.app/hackathons` | **SPA shell — 28 words.** Junction's platform page cannot be scraped; it is registered as a watch, and that is all it can be. |
| `cassini.eu/hackathons` | 200, 798 words, no JSON-LD and no travel language. Tier B circuit; still unpromotable. |
| `hackkosice.com` | 200, 285 words. Tier A circuit, Slovakia — worth a targeted parser eventually. |
| `techstars.com/.../startup-weekend` | 200, 430 words, RSC flight. Global programme, EU editions included. |
| `hackzurich.com` | 200, 46 words — "HackZurich is taking a break". Hiatus re-confirmed. |
| `innovationlabs.ro` | 200 but 34 words. Romania's big national programme, unscrapeable. |
| `eu-startups.com`, `lablab.ai`, `best.eu.org`, `ichack.org`, `lauzhack.com` | 403 Cloudflare interstitial. |
| `hackeps.com`, `europeandefensetech.com`, `hackathon.gr` | Do not resolve. |
| `mita.gov.mt/events/` | 404. |


## Pagination is a coverage decision, not a detail

**Devpost was returning 16% of its list.** `fetchDevpost` defaulted to 3 pages ×
9 events = 27, while `upcoming+open` runs to ~170 events across ~19 pages. The
remaining 143 were dropped silently, ordered by whatever Devpost ranks first —
which is dominated by US and online hackathons.

Found via **Since AI 2026** (Turku, €50k, MLH partner, 72h): it sits on **page
11**. Both of Devpost's European events were past the cut — the other,
MunichTech EXPO, on page 9. So the source was not "missing Europe" for any
interesting reason; Europe simply ranks low and we stopped reading early.

Fixed to 30 pages with a stop-on-empty loop; the full sweep costs ~4s. Page 1
returning zero now throws, because Devpost always has upcoming hackathons and a
silent empty is drift.

**The general lesson:** when an event is missing, check *how much of a source we
actually read* before concluding the source does not carry it. A page cap is a
coverage decision in disguise, and every paginated source should be audited the
same way.

### The audit (2026-08-04) — every source checked individually

Devpost was not alone. `scripts/probe-source-caps.mjs` walks *past* each
configured cap and reports where the data actually ends; it runs as a step in
`event-radar-turkey-probe.yml` because several of these 403 from a sandbox.
The question asked is deliberately not "does this source return rows" but
"does it still have more to give at the point we stop reading".

| Source | Configured cap | Measured end | Verdict |
|---|---|---|---|
| devpost | 30 × 9 | page 19, 170 events | ✅ clears |
| **allhackathons** | **MAX_PAGES 5** | **≥ page 12** | **❌ TRUNCATED → raised to 30** |
| hackclub | single request | 13 items, unpaginated | ✅ n/a |
| hackquest | limit 200 | 112 of 112 reported | ✅ clears |
| devfolio | size 100 | `application_open` total 24 | ✅ clears |
| taikai | perPage 100 | 2 | ✅ clears |
| ethglobal | n/a | 3 (its real hackathons; the other 553 page slugs are meetups it filters) | ✅ n/a |
| mlh | n/a | 61, single unpaginated payload | ✅ n/a |
| startuplithuania | MAX_PAGES 3 × 100 | breaks early when a page is short | ✅ clears |
| hacktrack | single request | one call, whole archive | ✅ n/a |
| **luma (primary query)** | **PAGES_PER_QUERY 2** | **7 pages / 290 entries** | **❌ TRUNCATED → primary raised to 10** |
| luma (rotation queries) | PAGES_PER_QUERY 2 | all exhaust on page 1 | ✅ never binds |
| unstop | MAX_PAGES 3 × 100 | `last_page` stop sits in front | ✅ clears |
| dorahacks | MAX_PAGES 4 × 50 | **unmeasurable** — WAF 405 even from a runner | ⚠️ raised to 40 on structure |
| hackerearth | single request | unmeasurable — 403 even from a runner | ⚠️ no cap to bind |
| known / watches / africa-au / tier-a-extra | n/a | static hand-maintained arrays | ✅ no pagination |

**allhackathons was the second real instance.** It was still serving 10 cards a
page at page 12 while we stopped at 5 — so **at least** 70 of its listed events
never reached the catalog, and the true list length is still unknown because the
probe hit its own walk ceiling at 12 rather than the site's end. (That is itself
worth remembering: a walk that stops at its own limit measures the limit, not
the data. The script now walks past each configured cap and reports
`INCONCLUSIVE` instead of a fake end.) Same shape as Devpost otherwise: nothing
failed, nothing logged, the events simply did not exist as far as the radar was
concerned.

**Luma was the third instance, and the most expensive one.** `PAGES_PER_QUERY`
was 2 for every query — but the queries are not alike. The ~150 city/region
queries genuinely exhaust on page 1 (Berlin 10 entries, London 20, Vilnius 1,
Paris 2), so the cap never binds for them. The always-run primary `hackathon`
query runs to **7 pages / 290 entries**, with `has_more` still true exactly where
we stopped. So every sweep, on the single broadest and most productive query in
the system, we were reading about a quarter of it. The primary now gets its own
budget of 10 (above the measured depth, so Luma's `has_more` ends the walk);
rotation queries stay at 2 because raising them would spend request budget to
fetch pages that do not exist. This one is a genuine trade rather than a free
win — see the budget note in `luma.ts`.

**On the two unmeasurable rows.** DoraHacks' 405 is not a probe bug — it is the
documented AWS WAF challenge that `dorahacks.ts` already handles by keeping the
pages it got. Since it can't be measured from open egress, its cap was raised on
a structural argument instead: the loop's real stop is the API's own `next`
cursor (`if (!body.next …) break`), so `MAX_PAGES` only ever binds when the list
is longer than we guessed. The same holds for allhackathons, whose crawl stops
when a page no longer advertises the next one. Raising a ceiling that sits
*behind* a natural stop condition costs zero extra requests and removes the
class of bug by construction — which is the right move when measurement is
unavailable, but it is reasoning, not evidence, and is labelled as such here.
HackerEarth has no pagination at all, so it has no cap to bind.

## Next candidates (in rough effort order)

1. ~~**Codemotion**~~ — **probed 2026-08-04; not a hackathon source.** Markup is
   fine (Nuxt, but the `__NUXT__` state is server-embedded and parseable, and
   the rendered text carries event titles/dates/cities), so this was never a
   scraping problem. The problem is the content: `/hackathons/` says outright
   *"Sorry, there are no Events that match these filters"* for upcoming and then
   lists only past editions — The Big Hack 2025 (Sep 2025), Big Hack ottava
   edizione (Jun 2025), then 2024 and older. Its ~500 upcoming "events across
   Europe" are all `meetup`/conference type (Cissone Summer Camp, ESPC26, Tech
   Lead Summit Milano). So the pan-EU scale is real but it is not hackathon
   scale — Codemotion's own hackathon programme has been dormant since Sept
   2025. `/api/events` 404s and `sitemap.xml` 500s, for the record. **Do not
   build the parser**; re-probe only if The Big Hack returns.
2. **Devpost in-person filter** — pass `challenge_type[]=in-person` in
   `devpost.ts` to bias the sweep toward travel-relevant events.
3. **Junction** — `hackjunction.app/hackathons` is a 28-word SPA shell, so the
   scrape path is closed; `api.hackjunction.com` was only *unreachable from this
   session* (`000`), so re-probe that from production. (Topcoder was tried this
   way and removed — it threw from production too; see the matrix row.)
2. **AKINDO** — allowlist `app.akindo.io`, then lift its API paths from the app
   bundle the same way HackQuest's query was recovered.
3. **Hackster** — retry from open egress; if still WAF-403, try the curl/proxy
   trick HackerEarth needed.

Everything else (Encode Club, AngelHack, HackZurich, Space Apps, Gitcoin,
Superteam Earn, ImagineCup, Kaggle) has no clean public feed today and/or is
already covered by Luma — skip until one of them ships an API.
