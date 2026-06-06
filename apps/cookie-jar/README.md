# Cookie Jar

Bank the hard things you've already conquered — then reach in for fuel when you're hurting.

Inspired by David Goggins' "cookie jar": when you're suffering and want to quit, you reach
back into the jar of past victories you've *earned* and remind yourself you can do hard
things.

## The idea
- Keep **multiple named jars** (e.g. _Fitness_, _Career_, _Comebacks_).
- Each jar holds **cookies** — a win you conquered. A cookie is a **title** (required), with
  an optional **story** and **date earned**.
- Two ways to use a jar:
  - **Show all** — scroll the full list of everything you've banked.
  - **Reach in** — pull out a *random* cookie, revealed with a little ceremony, for a hit of
    motivation. "Sharing" is just telling the story out loud when you draw one.

Private to you. Google sign-in; every row is gated by Row Level Security.

## Run locally
```bash
npm install          # from the repo root (npm workspaces)
npm run dev -w cookie-jar-personal-app
```
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind + Radix (mauve base, coral accent, dark only)
· Supabase (Postgres + Google OAuth) · installable PWA. Part of the Personal Hub monorepo —
its own Vercel project, Root Directory `apps/cookie-jar`.
