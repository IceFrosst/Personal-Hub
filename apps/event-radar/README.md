# Event Radar

Hackathons worth traveling to, found and ranked for you.

Good tech hackathons are scattered across Devpost, MLH, and dozens of university sites — and
the ones that reimburse travel are exactly the ones that are easy to miss. Event Radar sweeps
the free sources daily, uses an LLM to extract the facts the listings never structure (is
travel covered? is accommodation provided? can a business student enter?), ranks everything
against what actually matters from Lithuania, and pushes a phone notification when something
high-match appears.

## What it does

- **Ranked feed** limited to future hackathons with registration still open, with a
  transparent score — every card shows *why* it ranks where it does (travel covered +40,
  online +35, dev-only −30, …)
- **Detail sheet**: tap a card for the full picture — dates, deadline, score breakdown,
  the extracted description — plus per-hackathon notes
- **Status tracking**: interested → applying → applied, or hide it
- **Web push** when a new hackathon clears your score threshold (adjustable in settings)
- **Manual source refresh** for the app owner in Settings, with per-source results and no
  test-run push notifications
- **New tab**: everything ingested in the last 72h, newest first — see what a refresh found
- **Sources**: Devpost, MLH, ETHGlobal, Hack Club, HackerEarth, Luma, HackQuest, Devfolio,
  Taikai, DoraHacks, Startup Lithuania, All Hackathons, HackTrack EU — enriched via Groq/Gemini
  (all free tiers)

Applying is entirely on you — Event Radar finds and ranks events, it does not fill in or
submit anything.

## Run it locally

```bash
cd apps/event-radar
npm install
npm run dev
```

Needs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment.
Scheduled and manual ingest both need `SUPABASE_SERVICE_ROLE_KEY` plus
`GROQ_API_KEY`/`GEMINI_API_KEY`; the cron additionally needs `CRON_SECRET`, and scheduled
push needs the VAPID key pair.
`EVENT_RADAR_ADMIN_EMAIL` optionally overrides which verified Google account can run the
manual source refresh (it defaults to the portfolio owner).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Google OAuth, shared
portfolio project, `hackathon` schema) · Web Push (VAPID) · Vercel (daily cron)
