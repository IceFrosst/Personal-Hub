# Event Radar — Locked v1 Plan (ready for scaffold)

> **Status**: Decisions locked by Ignas (2026-07-17). Pure discovery version.
> **Built 2026-07-17** — scaffolded, migrated, and provisioned on branch
> `claude/hackathon-auto-apply-tool-hg8cwv`; ships on merge to `main`. Technical
> decisions Claude made: service-role key as server-only Vercel env var behind a
> CRON_SECRET route (same pattern as lock-in's cron), daily Vercel cron cadence.
> Live state now tracked in `apps/event-radar/CLAUDE.md`.

## Problem

I miss good technology hackathons (any tech) because they are scattered across many sites,
and applying takes too much time. The goal is an agent that finds high-match opportunities
so I only spend minutes instead of hours.

## v1 Scope (final)

**Pure discovery + ranking + status tracking + notifications.**
You still apply yourself. Apply Kit and auto-apply come later once the core works.

### Core actions
- Browse a ranked feed of matching open tech hackathons
- Mark status: interested / applying / applied / hidden
- Get phone web-push when a new high-match one appears

### Ranking priorities (highest first)
1. Travel expenses covered by sponsor (critical — based in Lithuania)
2. Accommodation provided
3. Open to business / non-engineering students
4. Neighbor-country discount (Latvia, Poland, Estonia, etc. → travel coverage matters less)
5. Online events automatically satisfy the travel filter

Tiebreaks: prize pool, registration deadline proximity.
Score is computed at read time (not stored).

### Sources
Maximize opportunities. Do **not** limit to a small curated European list.
Prefer any source (free) that can surface events with possible travel reimbursement.
Start with the highest-quality free sources (Devpost public API + MLH + others that are reliable).
Expand later. Background agent/routine keeps checking them.

### Pipeline notes
- Enrichment: use free models (Gemini Flash preferred for quality, Groq for speed).
  See root `CLAUDE.md` for `GEMINI_API_KEY` + `GROQ_API_KEY` guidance.
- Notifications: Web Push (VAPID, free).
- Global `hackathons` table writes need elevated privileges (service-role or restricted role).
  **Claude decides the cleanest technical route.**
- Scrape cadence: Claude decides (daily Vercel cron is probably enough; night deeper search
  with Claude usage is interesting later).

### Audience / offline / cost
- You + friends you invite (private multi-user, RLS)
- Online-first
- 100% free to run (Vercel + Supabase free tiers only)

## Data model (v1 — pure)

New Postgres schema: `hackathon`

### `hackathons` (global)
- id, title, url, source
- starts_at, ends_at, registration_deadline
- location / format (online / city / country)
- prize_pool
- travel_covered, accommodation_covered, open_to_business_students (bool / unknown)
- themes, raw_description, last_seen_at, created_at

### `user_hackathon_status` (per user, RLS)
- user_id, hackathon_id
- status (`interested` | `applying` | `applied` | `hidden`)
- notes, updated_at

### `user_preferences` (per user, RLS)
- user_id
- filters (json — travel / accommodation / student / neighbor rules)
- notification_settings (json)

### `push_subscriptions` (per user, RLS)
- user_id, subscription (json — Web Push endpoint + keys), created_at

No application_profiles or application_drafts tables in v1.

## Identity (locked)

- **Display name**: Event Radar
- **Slug**: `event-radar`
- **Accent**: purple (+ blue highlights)
- **Icon**: radar with a trophy element (custom tile); Tabler `radar-2` as fallback

## Explicitly out of v1

- Apply Kit / AI-drafted answers
- Browser auto-fill or auto-submit
- Paid sources
- CAPTCHA workarounds

## Roadmap (post-v1)

- Apply Kit (profile + drafted answers)
- Approval-gated browser auto-fill (Claude Code cloud sessions + Playwright)
- Broader source coverage + night search agents
- Opt-in auto-submit on trusted platforms

## Technical decisions left to Claude

1. Exact mechanism for writing to the global `hackathons` table (service-role key on Vercel vs restricted Postgres role).
2. Scrape cadence (daily Vercel cron vs more frequent).

Ignas will do any required manual steps (env vars, allowlist, etc.).

## Next step for Claude

Follow the normal Personal-Hub new-app checklist in root `CLAUDE.md`:
1. Scaffold `apps/event-radar/` (README + CLAUDE.md)
2. Register in `apps/hub/config/apps.json` + icon map
3. Vercel project
4. SQL migration for the `hackathon` schema
5. Auth redirect
6. Implement ranked feed + status + basic notifications + daily ingest

Ship the pure discovery version first.
