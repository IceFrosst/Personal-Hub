# Personal App Portfolio

Ignas's personal app portfolio — a launcher PWA that lists every app as a tile. Sign in with Google, pick a version (stable / previous / experimental), open the app.

## Apps

| App | What it does |
|-----|--------------|
| [Focus Gate](https://icefrosst-focus-gate-personal-app.vercel.app) | Intentional Instagram replacement — shows a pause screen with a task suggestion before letting you open Instagram |

## Stack

Next.js 15 · TypeScript · Tailwind CSS · Radix Colors (dark only) · Supabase (Postgres + Google OAuth) · Vercel free tier

## Adding a new app

Open a new Claude Code session against this repo, describe the idea, and the session handles everything: builds the code, creates the GitHub repo, sets up Vercel, runs the database migration, and registers the app in `config/apps.json`.

Each app lives in its own GitHub repo with three permanent branches (`stable` / `previous` / `main`) mapped to three Vercel deployments. The hub reads `config/apps.json` — one entry per app.

For the full spec, rules, and automation details see `CLAUDE.md`.
