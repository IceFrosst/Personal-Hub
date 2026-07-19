# Event Radar — capture plan (A–F)

How we cover ~250 high-signal hackathons without missing registration windows.

## A. Existing live sources (auto)

Devpost, MLH, ETHGlobal, HackerEarth, Hack Club, Luma, HackQuest, Devfolio, Taikai, DoraHacks, Unstop.

Cron: Vercel daily + GitHub Actions ~4×/day (`event-radar-ingest.yml`).

## B. New platform scrapers

| Source | File | Notes |
|--------|------|-------|
| Topcoder | `lib/ingest/topcoder.ts` | v5 Active challenges; filters to hackathon-like |
| (next) AngelHack, Junction API, Superteam | — | Add when prod egress confirms JSON |

## C. Luma multi-query

`lib/ingest/luma.ts` runs: `hackathon`, Singapore, Hong Kong, London, Paris, San Francisco, buildathon, Junction — 2 pages each, URL-deduped.

## D. Known events + watches

| Mechanism | File | Role |
|-----------|------|------|
| Exact seeds | `known-events.ts` | Junction, confirmed dated events |
| Annual windows | `watches.ts` | SIH, AdventureX, NASA Space Apps, Google SC, SG–India, HackUST, NUS Hack&Roll, CodeFest |

When real dates land, promote watch → known with exact deadline.

## E. Calendars / newsletters

Operational (not code): follow MLH calendar, Cerebral Valley, Superteam, Encode on X/Luma. Weekly human or agent pass → seed `known-events.ts`.

## F. Gov / one-off

Watches cover SIH + NASA + Google SC. Confirm on official domains each season.

## Verify after deploy

1. Settings → Manual Refresh  
2. Expect ~14 source lines including Topcoder, Known, Watches  
3. Topcoder may `error` from some regions — non-fatal  
4. Luma count should rise vs single-query baseline  
