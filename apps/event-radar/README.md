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
- **Apply Kit**: fill an application profile once, then paste any hackathon's form
  questions and get first-person draft answers (Groq/Gemini) with copy buttons — gaps in
  your profile come back as `[TODO]`s, never invented facts
- **Web push** when a new hackathon clears your score threshold (adjustable in settings)
- **Sources**: Devpost, MLH, ETHGlobal, Hack Club, HackerEarth — enriched via Groq/Gemini
  (all free tiers)

Submitting is still on you — approval-gated auto-fill is the next roadmap phase, tracked
in the root `EVENT_RADAR_PLAN.md`.

## Run it locally

```bash
cd apps/event-radar
npm install
npm run dev
```

Needs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment.
The ingest cron (`/api/cron/ingest`) additionally needs `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET`, `GROQ_API_KEY`/`GEMINI_API_KEY`, and the VAPID key pair for push.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Google OAuth, shared
portfolio project, `hackathon` schema) · Web Push (VAPID) · Vercel (daily cron)
