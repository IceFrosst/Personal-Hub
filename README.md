# Personal Hub

Launcher PWA for Ignas's personal app portfolio. Lists each app as a tile, lets users sign in with Google and pick which version of an app to open (`stable`, `previous`, `experimental`).

See `CLAUDE.md` for the full project spec and rules. See `SCHEMA_RULES.md` for what's safe to change in the database.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + Radix Colors (dark mode only, mauve neutral)
- Supabase (Postgres + Auth, Google OAuth) — one shared project for the whole portfolio
- Vercel free tier

## Configuration

The list of apps lives in `config/apps.json`. Each entry needs slug, name, description, Tabler icon name, color from the palette, and the three Vercel URLs (`stable` / `previous` / `experimental`).

Per iron rule #1 in `CLAUDE.md`: **no hardcoded URLs anywhere else in the codebase**. Cross-app links must read from `apps.json`.

## Database

Migrations live in `supabase/sql/`. Paste each file into the SQL editor in the Supabase dashboard to apply. Schema is additive-only — see `SCHEMA_RULES.md`.

## Deploying

Push to `main` → Vercel auto-deploys. Required env vars are documented in `CLAUDE.md` under the Supabase section.
