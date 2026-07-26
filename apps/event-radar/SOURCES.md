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

## Next candidates (in rough effort order)

1. **Codemotion** — probe `events.codemotion.com` markup, then parse. It is the
   only untapped listing that claims pan-EU coverage at scale.
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
