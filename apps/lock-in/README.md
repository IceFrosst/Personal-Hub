# Lock In

Tasks, prioritised. Voice in, lock in.

PWA companion to Focus Gate — same Supabase `focus_gate.tasks` table, with priority +
due dates layered on top. The "Lock in" button on the gate jumps straight here. Part of
the monorepo (`apps/lock-in`).

## Game Plan

A built-in AI day-scheduler (`/game-plan`). Connect Google Calendar and it reads your open
Lock In tasks, estimates how long each takes, and drops time blocks around your existing
events — writing them as real calendar events and showing the day as a timeline. Tap
"Plan my day" any time, or let the daily morning cron plan it automatically so you wake up
to a scheduled day. Uses Gemini (free tier) for the estimates, with a deterministic fallback
if the model is unavailable.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind, pure-black theme with gold accent
- Supabase SSR (Google OAuth, shared `focus_gate` schema)
- Tabler icons, Web Speech API (mic input)
- Deployed on Vercel free tier (production: `icefrosst-lock-in.vercel.app`)
