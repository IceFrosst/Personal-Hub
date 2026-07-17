# Event Radar — v1 Plan

> **Status**: Locked discovery summary. No code, folder, or schema has been created yet.
> Written by Grok for dual-agent review (Claude + Grok). Do not start scaffolding until both agents and Ignas agree.

## Problem

I miss good technology hackathons (any tech, not only AI/health) because they are scattered across Devpost, MLH, etc., and applying takes too much time. An agent should find matches for me and either prepare or (later) semi-auto apply so I only spend minutes instead of hours.

## v1 Scope (Minimum Useful Version)

Discovery + ranking + status tracking + notifications.  
**You still apply yourself.** Full auto-apply / form-filling is later (v2+).

### Core actions
- Browse a ranked feed of matching open tech hackathons
- Mark one as “I’m applying” or “already applied”
- Get notified (phone web-push preferred) when a new high-match one appears

### Key ranking / filters (highest priority first)
1. Travel expenses covered by sponsor (especially important — user is in Lithuania)
2. Accommodation provided
3. Open to business / non-engineering students (not pure dev-only)
4. Location nuance: if the event is in a neighboring country (Latvia, Poland, etc.), travel coverage becomes less critical
5. Online events automatically satisfy the travel filter

### Sources
- Start with the highest-quality **free** sources only: Devpost + MLH + 2–3 solid others
- Expand later (explicit roadmap item)
- Background agent / routine that regularly checks those sources (can later call Grok/Claude-style agents)

### Audience
You + friends you invite (private multi-user ready).

### Offline
Online-first. Live feed and notifications need a connection. Offline can be basic or none.

### Hard constraint
100% free to run (Vercel free tier + Supabase free tier only). No paid scrapers, no paid APIs.

## Data model (v1)

New Postgres schema: `hackathon`

### `hackathons` (global)
- id, title, url, source (devpost / mlh / …)
- starts_at, ends_at, registration_deadline
- location / format (online / city / country)
- prize_pool (number or text)
- travel_covered (bool / unknown)
- accommodation_covered (bool / unknown)
- open_to_business_students (bool / unknown)
- themes (text[] or json)
- raw_description, last_seen_at, created_at

### `user_hackathon_status` (per user)
- user_id, hackathon_id
- status (`interested` | `applying` | `applied` | `hidden`)
- notes (optional text)
- updated_at

### `user_preferences` (per user)
- user_id
- filters (json — travel / accommodation / student / neighbor rules)
- notification_settings (json)

Schema is additive-only forever (see root `SCHEMA_RULES.md`).

## Identity

- **Display name**: Event Radar
- **Slug** (folder + technical id): `event-radar`
- **Accent**: purple + blue (works with the dark mauve base; white used for text/highlights)
- **Icon direction**: radar with a trophy element somewhere in its radius (custom tile icon)

## What is explicitly out of v1

- Full browser auto-apply / form filling
- Paid data sources or scrapers
- Covering every possible hackathon site from day one
- Complex team-matching or idea generation

## Roadmap notes (post-v1)

- Expand sources beyond the initial free set
- Background agent that can call external LLMs (Grok / Claude) for deeper evaluation
- Semi-auto apply (prepare materials → fill forms with human approval)
- Better phone notification reliability

## Next step

Claude reviews this plan.  
Once both agents and Ignas are aligned, follow the normal Personal-Hub new-app checklist in root `CLAUDE.md` (scaffold `apps/event-radar/`, register in hub, migrations, etc.).
