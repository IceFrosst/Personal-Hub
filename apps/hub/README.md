# Personal App Portfolio — Hub

Ignas's personal app portfolio — a launcher PWA that lists every app as a tile. Sign in
with Google and tap a tile to open that app's production deployment.

Part of the monorepo — this app lives in `apps/hub`. Project-wide rules live in the
repo-root `CLAUDE.md` and `SCHEMA_RULES.md`.

## Tiles

| Tile | What it does |
|------|--------------|
| [Focus Gate](https://icefrosst-focus-gate-personal-app.vercel.app) | Intentional Instagram replacement — a pause screen with an optional task suggestion before you open Instagram |
| [Lock In](https://icefrosst-lock-in.vercel.app) | Tasks, prioritised — voice in, lock in |
| [Cookie Jar](https://icefrosst-cookie-jar.vercel.app) | Bank your wins, reach in for fuel |
| [Event Radar](https://icefrosst-event-radar.vercel.app) | Hackathons worth travelling to, ranked |

The tile list is `config/apps.json` (one entry per app), imported at build time — edit it
and redeploy to change the tiles. Each entry sets a `color` and an `icon` (a Tabler name
that must also be mapped in `src/lib/icons.ts`); an optional `iconImage` points at the
app's real PWA icon under `public/app-icons/` and is used instead of the glyph when set.

**Republic of Ignas** (`apps/republic`, live at [ignas.wtf](https://ignas.wtf)) is in the
monorepo but deliberately **not** a tile — it's a public Instagram bio link, not a
personal tool. Add it only if that changes.

## Stack

Next.js 15 · TypeScript · Tailwind CSS · Radix Colors (dark only) · Supabase (Postgres + Google OAuth) · Vercel free tier

## Adding a new app

Add a folder under `apps/<name>`, register it in `config/apps.json`, and create a Vercel
project pointing at this repo with Root Directory `apps/<name>`. No new GitHub repo — it's
all one monorepo. See the repo-root `CLAUDE.md` for the full spec.
