# Event Radar — Merged Plan (Grok draft × Claude review)

> **Status**: Merged plan. Grok wrote the v1 draft; Claude reviewed it, researched feasibility,
> and merged in the apply-automation side. No code, folder, or schema has been created yet.
> **Do not start scaffolding until Grok has seen this merge and Ignas gives the thumbs-up**
> (open decisions listed at the bottom).

## Problem

I miss good technology hackathons (any tech, not only AI/health) because they are scattered
across Devpost, MLH, university circuits, etc. — and applying takes too much time. The north
star is an agent that **finds matches, prepares the application, and submits it with minimal
(eventually zero) effort from me**, so I get chances to build things and travel.

## Where the two plans differed — and the resolution

Both agents agree on the foundation: discovery + ranking + tracking + notifications, free-only,
additive schema, multi-user-ready, and Grok's filter priorities (travel coverage first). The
disagreement was about the apply side:

- **Grok's draft**: v1 is discovery only — "you still apply yourself." Auto-apply is a vague
  roadmap line. *Rationale: form-filling is brittle and risky; don't block v1 on it.*
- **Claude's take**: Grok's caution about *unattended* auto-apply is correct — heterogeneous
  forms, logins, and CAPTCHAs make it brittle, and a bot that submits unreviewed answers can
  misrepresent you to organizers. **But** the actual time sink is writing answers, not clicking
  submit. That part is automatable today with zero brittleness: an **Apply Kit** (profile +
  AI-drafted answers per hackathon) is one table, one Gemini call, and one screen — cheap
  enough to belong in v1.
- **Resolution — an apply ladder**: v1 ships discovery **plus** the Apply Kit (agent writes,
  you paste and submit — minutes instead of an hour). v1.5 adds approval-gated auto-fill (agent
  fills the real form in a browser, you approve a screenshot, it submits). v2 adds opt-in
  auto-submit for trusted platforms only. Full detail below.

This keeps Grok's "don't block v1 on browser automation" and still makes the app an *apply*
tool from day one, which is the point of the whole thing.

## The shape — three lanes

1. **Radar** (v1): scheduled scrape → AI enrichment → ranked feed → phone push for high matches.
2. **Apply Kit** (v1): stored applicant profile + per-hackathon drafted answers. You submit.
3. **Auto-apply ladder** (v1.5 → v2): agent fills and submits forms with decreasing human
   involvement, gated by approval and per-platform trust.

## v1 scope

### Core actions
- Browse a ranked feed of matching open tech hackathons ("why this rank" shown on each tile)
- Tap **Prepare application** → get a drafted, tailored answer pack to copy into the real form
- Mark status: interested / applying / applied / hidden
- Get a phone web-push when a new high-match hackathon appears

### Ranking (from Grok's priorities, formalized into a score)
Deterministic score computed from enriched fields — highest weight first:
1. Travel expenses covered (critical — based in Lithuania)
2. Accommodation provided
3. Open to business / non-engineering students
4. Neighbor-country discount: event in Latvia / Poland / Estonia / etc. → travel coverage
   matters less
5. Online events automatically satisfy the travel filter
Tiebreaks: prize pool, registration deadline proximity. Score is computed at read time (not
stored), so re-weighting never needs a migration. Fields Gemini can't determine stay `unknown`
and are surfaced as such, never guessed.

### Sources (v1 — free, no headless browser needed for discovery)
- **Devpost** — public JSON API (`devpost.com/api/hackathons`): title, url, dates, prize,
  themes, location, open state, no auth needed. Detail pages fetched for full description.
- **MLH** — season events page, static HTML (name, dates, city, in-person/digital).
- **Curated European circuit list** — the hackathons that actually reimburse travel
  (HackUPC, Junction, LauzHack, HackZurich, START Hack, HackKosice, ETHGlobal, …) mostly
  aren't on Devpost. v1 keeps a small seed list of organizer event pages the pipeline checks.
  Expanding this list is a standing roadmap item.

### Pipeline mechanics
- **Scheduler**: Vercel cron on the event-radar project — Hobby tier allows one run per day
  (±59 min precision), which is enough: hackathon deadlines move in weeks, not hours. If daily
  proves too slow, add a free GitHub Actions cron (every 6h) calling the same ingest route —
  no architecture change.
- **Enrichment**: `GEMINI_API_KEY` (`gemini-flash-latest`, free tier, server-side only,
  `responseMimeType: 'application/json'`): raw description → `travel_covered`,
  `accommodation_covered`, `open_to_business_students`, `themes`, format. Graceful fallback:
  on API failure the hackathon still lands in the feed with fields `unknown`.
- **Ingestion writes**: global tables can't be written with the anon key (RLS). The cron
  route runs server-side on Vercel with `SUPABASE_SERVICE_ROLE_KEY` as a server-only env var
  on the event-radar project, protected by `CRON_SECRET`. ⚠️ This is a deviation from
  "service key lives only in the password manager" — needs Ignas's explicit OK (decision #2).
- **Notifications**: Web Push (VAPID — free, no external service). Solid on Android/Pixel;
  works for friends on iOS 16.4+ installed PWAs. Fired when a new hackathon scores above the
  user's threshold.

### Audience / offline / cost
Ignas + invited friends (multi-user from day one, RLS on all per-user tables). Online-first;
offline is a nice-to-have shell at best. **100% free to run** — Vercel free + Supabase free +
Gemini free tier. No paid scrapers, no paid APIs.

## Apply Kit (v1) — the part that saves the hours

- **Profile** (per user, one-time setup): name, school + degree (business student), country,
  GitHub/LinkedIn/portfolio links, CV link, past projects & hackathons, motivation blurbs,
  t-shirt size, dietary — the stuff every form asks.
- **Prepare application**: Gemini takes profile + the hackathon's description/questions and
  drafts tailored answers ("Why do you want to attend X?", "Tell us about a project…").
  Rendered as a copy-friendly pack next to a link to the real form.
- Draft answers are stored (per user + hackathon) so they're editable and reusable; marking
  "applied" keeps the pack as a record of what was submitted.
- **Honesty rule**: drafts are generated only from the user's real profile — the agent never
  invents achievements. The user reads before submitting; that's a feature, not a limitation.

## Auto-apply ladder (post-v1)

- **v1.5 — approval-gated auto-fill**: a scheduled Claude Code cloud session (Routine) opens
  the application form with Playwright (Chromium is preinstalled in the cloud env), fills it
  from the Apply Kit, screenshots the completed form, and pushes an approval request. On
  approve → submit. Works best on Typeform / Google Forms / Devpost registration; anything
  with a CAPTCHA or unexpected login is flagged back to the human instead of fought.
- **v2 — policy auto-submit**: per-platform opt-in. Only when: platform is on the user's
  trusted list **and** score ≥ threshold **and** the form contains no questions the Kit hasn't
  answered before. Everything is logged; a push notification confirms each submission.
- **Known risks, stated plainly**: heterogeneous forms break scripts; CAPTCHAs are a hard
  stop by design (we don't evade them); platform logins mean storing sessions carefully;
  some platforms' ToS frown on automation — the trusted-list gate exists for that reason.

## Data model (v1)

New Postgres schema `hackathon` — Grok's tables kept verbatim, plus three additive tables
for the apply lane. Additive-only forever (root `SCHEMA_RULES.md`).

### `hackathons` (global — written only by the ingest route)
- id, title, url, source (`devpost` / `mlh` / `curated`)
- starts_at, ends_at, registration_deadline
- location / format (online / city / country)
- prize_pool (text), travel_covered, accommodation_covered,
  open_to_business_students (each bool, nullable = unknown)
- themes (jsonb), raw_description, last_seen_at, created_at

### `user_hackathon_status` (per user, RLS)
- user_id, hackathon_id, status (`interested` | `applying` | `applied` | `hidden`),
  notes, updated_at

### `user_preferences` (per user, RLS)
- user_id, filters (jsonb — travel / accommodation / student / neighbor rules),
  notification_settings (jsonb)

### `application_profiles` (per user, RLS) — *added in merge*
- user_id, profile (jsonb — the Apply Kit fields), updated_at

### `application_drafts` (per user, RLS) — *added in merge*
- user_id, hackathon_id, answers (jsonb — question → drafted answer), created_at, updated_at

### `push_subscriptions` (per user, RLS) — *added in merge*
- user_id, subscription (jsonb — Web Push endpoint + keys), created_at

## Identity (locked by Grok — kept)

- **Name**: Event Radar · **Slug**: `event-radar`
- **Accent**: `purple` in `apps.json`; purple + blue in-app on the dark mauve base
- **Icon**: radar with a trophy element (custom tile icon); Tabler `radar-2` as the mapped
  fallback in `apps/hub/src/lib/icons.ts`

## Out of v1

- Unattended auto-submit (that's the v2 ladder rung, opt-in only)
- Paid data sources or scrapers
- Covering every hackathon site from day one
- Team-matching or idea generation
- CAPTCHA workarounds of any kind — never in any version

## Decisions for Ignas (blocking scaffold)

1. **Apply Kit in v1** — agreed it's in scope? (Adds the profile setup screen + 3 tables.)
2. **Service-role key on Vercel** — OK to place `SUPABASE_SERVICE_ROLE_KEY` as a server-only
   env var on the event-radar Vercel project (needed for cron ingestion of the global table)?
   Alternative: a dedicated Postgres role with insert-only grants on `hackathon.hackathons`.
3. **Session-env allowlist** — add `devpost.com` and `mlh.io` to the Claude Code environment
   network allowlist so scrapers can be tested in-session (production Vercel/Actions egress
   is unrestricted regardless).
4. **Curated seed list** — confirm/edit the European circuit list above.
5. **Cadence** — daily Vercel cron enough for v1, or add the 6-hourly GitHub Actions lane now?

## Next step

Grok reads this merge; Ignas answers the five decisions. Then follow the normal Personal-Hub
new-app checklist in root `CLAUDE.md` (scaffold `apps/event-radar/` with README + CLAUDE.md,
register in hub `apps.json` + icon map, Vercel project, SQL migration, auth redirect).
