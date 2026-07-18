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
| `hackquest.io` · `api.hackquest.io` · `www.hackquest.io` | 🟡 Reachable | GraphQL API is live (`POST api.hackquest.io/graphql` answers), but **Apollo introspection is disabled** and no REST path exists (`/hackathon`, `/api/hackathon` → 404). Needs the exact query lifted from the frontend JS. Doable, not blind. |
| `akindo.io` · `api.akindo.io` · `www.akindo.io` | 🟡 Reachable | `api.akindo.io` is a live NestJS API (returns structured `{statusCode:404}`), but no endpoint discovered (`/hackathons`, `/waves`, `/v1/hackathons`, `/communities` all 404). `www.akindo.io` itself → `000` (bot-blocked HTML). Needs endpoint names from the frontend. |
| `spaceappschallenge.org` · `www.` | 🟡 Reachable | Site loads (200). NASA Space Apps is **one global annual event** — no list API; would be a bespoke single-event HTML scrape. Low effort/low yield. |
| `hackjunction.com` · `www.` · `api.hackjunction.com` | 🟡 Reachable | `www` loads (200) as a SPA; `api.hackjunction.com` → `000` from here. Junction runs an events API — retry the api subdomain from production Vercel. |
| `kaggle.com` · `www.` | ❌ | Site 200, but `/competitions.json` → 404; listings need the **authenticated** official Kaggle API. Also: Kaggle competitions are ML contests, not really hackathons — deprioritize. |
| `topcoder.com` · `www.` | ❌ here | `www` 200, but `api.topcoder.com/v5/challenges` → `000` (unreachable from this session). The v5 challenges API is public and JSON in general — **re-probe from production Vercel**, likely implementable there. |
| `encode.club` · `encodeclub.com` · `www.encode.club` | ❌ (covered) | Marketing/Framer site, no event API. **Not needed** — Encode Club hackathons already surface through the Luma feed (e.g. "…London Encode Club"). |
| `angelhack.com` · `www.` | ❌ | Marketing site (301 → home), no machine-readable event feed. |
| `hackzurich.com` · `www.` | ❌ | Single annual event, marketing site. No feed. |
| `gitcoin.co` · `www.` | ❌ | Next.js app; the old `/api/v0.1/hackathons` now 404s. Gitcoin has pivoted away from a hackathon list API — no clean feed. |
| `earn.superteam.fun` | ❌ | `/api/listings` redirects to `superteam.fun/api/...` which then `000`s / 404s. No working listings feed found. Re-probe if Superteam republishes the API. |
| `imaginecup.microsoft.com` | ❌ | 307 → Microsoft auth flow. No public event feed. |
| `hackster.io` · `www.` · `api.hackster.io` | ❌ | `www` → **403 (WAF)**, `api` → `000`. Same class as Devpost/MLH in interactive sessions. Retry from production egress; may need a curl-via-proxy path like HackerEarth. |

## Implemented this pass

- **Luma** (`lib/ingest/luma.ts`, wired into `lib/ingest/run.ts`, label in
  `lib/refresh-summary.ts`, unit test `test/luma.test.ts`). The query is fuzzy,
  so the parser keeps only entries whose **name** mentions a hackathon / hack
  day / hack night / game jam, dropping near-misses like "Cafe Cursor". Crawls
  up to 4 cursor pages (~150 candidates). The existing fail-closed eligibility
  rule (`isUpcomingAndOpen`) drops the many same-day/past entries the search
  also returns.

## Next candidates (in rough effort order)

1. **Topcoder** & **Junction** — public APIs that were only *unreachable from
   this session*. Re-probe `api.topcoder.com/v5/challenges` and
   `api.hackjunction.com` from a production Vercel run; if they answer there,
   both are clean JSON sources.
2. **HackQuest** — lift the GraphQL query for the hackathon explorer from the
   frontend bundle, then a normal `POST /graphql`.
3. **AKINDO** — find the real `api.akindo.io` endpoint names from the frontend.
4. **Hackster** — retry from open egress; if WAF-blocked, try the curl/proxy
   trick HackerEarth needed.

Everything else (Encode Club, AngelHack, HackZurich, Space Apps, Gitcoin,
Superteam Earn, ImagineCup, Kaggle) has no clean public feed today and/or is
already covered by Luma — skip until one of them ships an API.
