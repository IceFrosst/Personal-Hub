# Lock In

Tasks, prioritised. Voice in, lock in.

PWA companion to Focus Gate — same Supabase `focus_gate.tasks` table, with priority +
due dates layered on top. The "Lock in" button on the gate jumps straight here. Part of
the monorepo (`apps/lock-in`).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind, pure-black theme with gold accent
- Supabase SSR (Google OAuth, shared `focus_gate` schema)
- Tabler icons, Web Speech API (mic input)
- Deployed on Vercel free tier (production: `icefrosst-lock-in.vercel.app`)
