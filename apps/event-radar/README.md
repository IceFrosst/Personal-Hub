# Event Radar

Hackathons worth traveling to, found and ranked for you.

Good tech hackathons are scattered across Devpost, MLH, and dozens of university sites — and
the ones that reimburse travel are exactly the ones that are easy to miss. Event Radar sweeps
the free sources daily, uses an LLM to extract the facts the listings never structure (is
travel covered? is accommodation provided? can a business student enter?), ranks everything
against what actually matters from Lithuania, and pushes a phone notification when something
high-match appears.

## What it does (v1 — pure discovery)

- **Ranked feed** of open hackathons with a transparent score — every card shows *why* it
  ranks where it does (travel covered +40, online +35, dev-only −30, …)
- **Status tracking**: interested → applying → applied, or hide it
- **Web push** when a new hackathon clears your score threshold (adjustable in settings)
- **Sources**: Devpost public API + MLH season pages, enriched via Groq/Gemini (both free
  tiers). More sources are a standing roadmap item.

Applying is still on you — the Apply Kit (AI-drafted answers) and approval-gated auto-fill
are the post-v1 roadmap, tracked in the root `EVENT_RADAR_PLAN.md`.

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
