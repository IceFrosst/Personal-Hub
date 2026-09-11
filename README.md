# icefrosst personal apps — monorepo

Ignas's personal app portfolio. Six Next.js apps in one repo, each with its own Vercel
project and its own Postgres schema inside one shared Supabase project. Five are private
tools behind a single Google login; one is a public Instagram bio link with no login at
all. Started as three separate GitHub repos; consolidated here on 2026-05-29 so shared
rules, schema and tooling live in one place and a new app is just a new folder — no new
repo, no new access grant.

**Hard constraint: 100% free to run.** Vercel free tier + Supabase free tier, and nothing
else. If a feature needs a paid service, it doesn't get built until that's discussed.

## The apps

| App | Folder | What it is | Live |
|-----|--------|------------|------|
| **Hub** | `apps/hub` | Launcher — lists every app as a tile, sign in with Google, tap to open | [icefrosst-hub.vercel.app](https://icefrosst-hub.vercel.app) |
| **Focus Gate** | `apps/focus-gate` | The pause screen you hit when you reach for Instagram. Lock in, or take the break on purpose | [icefrosst-focus-gate-personal-app.vercel.app](https://icefrosst-focus-gate-personal-app.vercel.app) |
| **Lock In** | `apps/lock-in` | Tasks, prioritised. Voice in, lock in — plus an AI day-scheduler that writes blocks into Google Calendar | [icefrosst-lock-in.vercel.app](https://icefrosst-lock-in.vercel.app) |
| **Cookie Jar** | `apps/cookie-jar` | Bank the hard things you've already conquered, reach in for fuel when you're hurting | [icefrosst-cookie-jar.vercel.app](https://icefrosst-cookie-jar.vercel.app) |
| **Event Radar** | `apps/event-radar` | Hackathons worth travelling to, swept from 15 free sources daily and ranked for a Lithuanian student | [icefrosst-event-radar.vercel.app](https://icefrosst-event-radar.vercel.app) |
| **Republic of Ignas** | `apps/republic` | Deadpan border-control link-in-bio for Instagram — every social ask is a visa application | [ignas.wtf](https://ignas.wtf) |

Focus Gate and Lock In are a pair: they read and write the **same** task table, so a task
captured in one shows up in the other. Everything else is self-contained.

Republic is the odd one out on purpose — it's public-facing, has no login, and is
deliberately **not** a hub tile (see *Deployment* below).

## Layout

```
.
├── CLAUDE.md            # the spine — rules, conventions, env vars (canonical, repo-wide)
├── AGENTS.md            # entry point for Codex; routes to CLAUDE.md
├── SCHEMA_RULES.md      # additive-only schema rules (canonical, repo-wide)
├── apps/
│   ├── hub/             # launcher PWA — tiles come from config/apps.json
│   ├── focus-gate/      # the Instagram gate
│   ├── lock-in/         # tasks + AI day-scheduler
│   ├── cookie-jar/      # jar of past wins
│   ├── event-radar/     # hackathon radar (daily ingest + push digest)
│   └── republic/        # Instagram link-in-bio, border-control themed
├── docs/                # mockups + Vercel notes
└── scripts/             # setup-vercel-project.mjs (bootstraps a new app's Vercel project)
```

Three root files are **history, not instructions** — original plans kept for the reasoning
behind decisions, each now carrying a status banner: `EVENT_RADAR_PLAN.md`,
`SIDEQUEST_PLAN.md` and `REPUBLIC_SETUP.md`. Where they disagree with an app's
`CLAUDE.md`, the `CLAUDE.md` wins.

Each `apps/<name>/` carries **two** docs, and both matter:

- **`README.md`** — what the app is and how to run it (human / GitHub facing).
- **`CLAUDE.md`** — technical context and live handoff state for Claude Code, Grok and
  Codex. Its `Current state` / `Next` sections are the source of truth for where that app
  actually stands.

There is no `packages/` yet. Shared code (the Supabase client, the `Task` type) is still
duplicated per app — extracting it is a known, deferred piece of work.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind + Radix Colors (**dark mode only**) ·
Tabler icons · installable PWA · Supabase (Postgres + Google OAuth) · Vercel free tier ·
npm workspaces + Turborepo.

Groq and Gemini (both free tiers) do the AI work: Lock In's scheduling, Focus Gate's task
nudge, Event Radar's listing enrichment.

## Data

**One Supabase project for the whole portfolio** (`icefrosst-apps`, region Europe). Apps
are separated by Postgres schema, not by project:

| Schema | Owner | Holds |
|--------|-------|-------|
| `hub` | Hub | per-user app preferences (reserved, unused) |
| `focus_gate` | Focus Gate | `tasks` — **shared with Lock In**, which added `priority` and `due_date` |
| `lock_in` | Lock In | Game Plan scheduling tables |
| `cookie_jar` | Cookie Jar | `jars`, `cookies` |
| `hackathon` | Event Radar | the global hackathon catalog + per-user status, prefs, push subscriptions |
| `republic` | Republic | visa applications, appointments, draft-event audit trail |

Two rules that are not negotiable, both spelled out in `SCHEMA_RULES.md`:

1. **Schema changes are additive forever.** Add columns, tables and JSON fields; never
   rename, never delete, never narrow a type. An older installed PWA must keep working
   against data written by a newer one.
2. **Row Level Security on every user-data table.** Every row carries `user_id`, and
   policies scope reads and writes to `auth.uid()`. The anon key is public by design —
   RLS is what protects the data.

## Develop

npm workspaces + Turborepo, driven from the repo root.

```bash
npm install                               # install every workspace
npm run dev                               # run every app
npm run dev -- --filter=./apps/lock-in    # run one app
npm run build && npm run lint             # build / lint all
npm run typecheck                         # tsc --noEmit across workspaces
```

Per-app commands also work from inside each `apps/*` folder. Event Radar additionally has
`npm test` (its ingest parsers and scoring are unit-tested).

## Deploy

Production ships from `main`. Every app is a separate Vercel project pointing at this
repo with **Root Directory** `apps/<name>` and an *Ignored Build Step* of
`npx turbo-ignore`, so a push only rebuilds the apps whose files actually changed.
Rollback is Vercel's instant rollback — promote an earlier deployment.

Two things to know before pushing:

- **Vercel Hobby allows 100 deployments/day account-wide**, and this account has other
  projects besides the portfolio. That's why the ignored-build-step matters.
- **Vercel sometimes misses the production build webhook on a merge.** If `main`'s head
  has no production deployment after a few minutes, trigger one through the API — the
  exact call is in `CLAUDE.md` under *Shipping gotchas*.

**Republic deploys differently.** Its Vercel project (`republic-of-ignas`) is **not
git-linked** — the API reports no repository link and no production branch — so a push to
`main` does *not* deploy it. It ships by running the Vercel CLI from a checkout, and it is
the one app on a custom domain (`ignas.wtf`, plus `www.`). It is also absent from the
hub's tile list by choice: it's a public Instagram bio link, not a personal tool.

## Working in this repo

Three agents share it — Claude Code, Grok and Codex — and any of them may pick up where
another stopped. The living docs *are* the handoff; there are no separate handoff files.

1. Read the root `CLAUDE.md` in full. It is the spine: iron rules, visual system, env
   vars, and the new-app checklist.
2. Read `apps/<name>/CLAUDE.md` for every app you touch.
3. Check the branch, working tree and recent commits before editing — continue work in
   flight, don't replace it.
4. Update that app's `Current state` and `Next` **in the same commit** as the code.
5. Never push straight to `main` without confirmation.

Codex enters through `AGENTS.md`, which routes to the same place.

## Adding an app

A new app is a folder, not a repo. Scaffold `apps/<name>` (it joins the workspace via the
`apps/*` glob), write both docs, register it in `apps/hub/config/apps.json`, map its icon
in `apps/hub/src/lib/icons.ts`, create its Vercel project with
`node scripts/setup-vercel-project.mjs`, apply its SQL through the Supabase Management
API, and add its callback to the auth redirect list. The full checklist, including which
steps are still manual, is in `CLAUDE.md`.

> Migrated from the former standalone repos `focus-gate-personal-app` and
> `lock-in-personal-app`; their git history is preserved here under `apps/*`.
