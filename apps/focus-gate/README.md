# Focus Gate

Intentional Instagram replacement — the gate you hit when you reach for Instagram.

A full-screen "HOLD UP" interstitial with two choices: **Lock in** (jumps to the Lock In
app) or **Having a break** (deep-links to Instagram). When you're signed in it can show an
optional "Maybe do this first?" nudge — one task pulled from your `focus_gate.tasks`,
picked by Gemini with a deterministic fallback.

Deliberately disguised as Instagram (icon, name, theme) so it sits in that muscle-memory
slot on your home screen. Part of the monorepo (`apps/focus-gate`).

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind + Radix Colors (dark only)
- Supabase SSR (shared `focus_gate` schema)
- Gemini (`gemini-2.0-flash`) for the optional suggestion — falls back to a heuristic when `GEMINI_API_KEY` is unset
- PWA (installable); deployed on Vercel free tier (production: `icefrosst-focus-gate-personal-app.vercel.app`)

## Env

See `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optional `GEMINI_API_KEY`.
