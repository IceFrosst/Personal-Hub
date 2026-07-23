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
| `topcoder.com` · `www.` | ❌ here | `www` 200, but `api.topcoder.com/v5/challenges` → `000` (unreachable from this session). The v5 challenges API is public and JSON in general — **re-probe from production Vercel**, likely implementable there. |
| `encode.club` · `encodeclub.com` · `www.encode.club` | ❌ (covered) | Marketing/Framer site, no event API. **Not needed** — Encode Club hackathons already surface through the Luma feed (e.g. "…London Encode Club"). |
| `angelhack.com` · `www.` | ❌ | Marketing site (301 → home), no machine-readable event feed. |
| `hackzurich.com` · `www.` | ❌ | Single annual event, marketing site. No feed. |
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

Both are wired into `lib/ingest/run.ts` and labelled in `lib/refresh-summary.ts`.
The shared fail-closed eligibility rule (`isUpcomingAndOpen`) drops the many
already-started / closed-registration entries either source returns.

## Next candidates (in rough effort order)

1. **Topcoder** & **Junction** — public APIs that were only *unreachable from
   this session* (`api.topcoder.com/v5/challenges`, `api.hackjunction.com` both
   `000`). Re-probe from a production Vercel run; if they answer there, both are
   clean JSON sources.
2. **AKINDO** — allowlist `app.akindo.io`, then lift its API paths from the app
   bundle the same way HackQuest's query was recovered.
3. **Hackster** — retry from open egress; if still WAF-403, try the curl/proxy
   trick HackerEarth needed.

Everything else (Encode Club, AngelHack, HackZurich, Space Apps, Gitcoin,
Superteam Earn, ImagineCup, Kaggle) has no clean public feed today and/or is
already covered by Luma — skip until one of them ships an API.
