# Event Radar — capture plan (A–F) + how to let agents test

## How Grok / Claude can test live HTTP (sandbox is blocked)

The coding sandbox often gets `connection refused` / HTTP 000 to third-party
hackathon hosts. **Do not rely on sandbox curl.** Use one of these instead:

### Option 1 — GitHub Actions probe (recommended, no secrets in chat)

1. Repo already has `.github/workflows/event-radar-probe.yml`.
2. GitHub → **Actions** → **Event Radar source probe** → **Run workflow**.
3. When green, download artifact **probe-results** (`probe-results.json`).
4. Paste that JSON into chat, **or** grant the agent permission to read Actions
   artifacts / workflow logs.

Same for **Event Radar watch agent** (annual pages).

### Option 2 — Production ingest (tests full pipeline)

1. Ensure repo secret `EVENT_RADAR_CRON_SECRET` matches Vercel `CRON_SECRET`.
2. Actions → **Event Radar ingest** → **Run workflow**.
3. Workflow logs print the JSON summary (`sources`, `inserted`, `enriched`).
4. Paste the log summary into chat for the agent to interpret.

### Option 3 — Manual Refresh in the app

Settings → Manual Refresh → copy the toast/details line into chat.

### Option 4 — Allowlist (only if your agent host supports it)

If the agent environment uses an egress allowlist, add:

`devpost.com`, `api.lu.ma`, `api.devfolio.co`, `api.taikai.network`,
`dorahacks.io`, `unstop.com`, `api.topcoder.com`, `api.hackquest.io`,
`ethglobal.com`, `www.mlh.com`, `hackjunction.com`, `sih.gov.in`,
`adventure-x.org`, `spaceappschallenge.org`, `cerebralvalley.ai`

---

## A–F capture layers

| Layer | Mechanism |
|-------|-----------|
| A | Existing scrapers in `lib/ingest/*` + 4×/day cron |
| B | Topcoder (+ future AngelHack/Junction when probe OK) |
| C | Luma multi-query |
| D | `known-events.ts` + `watches.ts` |
| E | Watch agent weekly + human/newsletter pass |
| F | SIH / NASA / Google SC watches |

## Agent workflows

| Workflow | Cadence | Output |
|----------|---------|--------|
| `event-radar-probe.yml` | Nightly + manual | `probe-results.json` |
| `event-radar-watch-agent.yml` | Weekly Mon + manual | `watch-probe-results.json` |
| `event-radar-ingest.yml` | 4×/day + manual | Production ingest JSON |

## After probe fails

- Non-critical source red → leave wired; cron degrades per-source.
- Critical (Devpost/Luma/Devfolio) red → fix scraper or allowlist immediately.
- Watch page shows `reg_language` → update `known-events.ts` with exact dates.
