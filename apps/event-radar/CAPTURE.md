# Event Radar — capture plan + Tier A/B

## How Tier A / Tier B events are caught (4 layers)

```
1. known-events.ts     → always seeded with official URL + approx dates
2. Platform feeds      → MLH / Devpost / ETHGlobal / Luma / Taikai may list them
3. travel-priority.ts  → title/host match → badge, score, circuit travel prior, FAQ crawl
4. Individual probes   → weekly GitHub Action hits EACH official site + /faq
```

| Layer | Misses when… | Fixed by |
|-------|----------------|----------|
| known seeds | Dates wrong / past | Update seed; probe alert |
| MLH/Devpost | Not listed yet | known seed still shows |
| Title match | Weird branding | hostPatterns on official domain |
| Individual probe | Site down / WAF | Manual check |

### Individual checkers

`scripts/probe-travel-priority.mjs` runs **one check per circuit** (18 total):

- Homepage GET
- Up to 2 FAQ/travel paths
- Signals: `reg_open_language`, `travel_language`, `has_year`, `maybe_closed`
- `alert: true` when registration language found

Workflow: **Event Radar watch agent** (weekly Mon + manual).
Artifact: `travel-priority-probe.json`.

When `reg_alerts` is non-empty → update `known-events.ts` with real deadlines and re-ingest.

### App verification

Filter chip **Travel tier** = anything matching the 18 checkers (even if `travel_covered` still null).
Chip **Travel ✓** = enrichment confirmed `travel_covered === true`.

## How to let agents test

1. Actions → Event Radar watch agent → Run workflow  
2. Download artifact / read job log for per-circuit OK/FAIL and `[REG?]` alerts  
3. Actions → Event Radar ingest → Run workflow (needs `EVENT_RADAR_CRON_SECRET`)  
