# icefrosst personal apps — monorepo

Ignas's personal app portfolio. Previously three separate GitHub repos; consolidated
into this single monorepo on 2026-05-29 so that shared rules, schema, and tooling live
in one place and a new app is just a new folder (no new repo, no new access grant).

## Layout

```
.
├── CLAUDE.md            # project spine — rules & conventions (canonical, repo-wide)
├── SCHEMA_RULES.md      # additive-only schema rules (canonical, repo-wide)
├── apps/
│   ├── hub/             # launcher PWA — lists the apps below (config/apps.json)
│   ├── focus-gate/      # intentional Instagram replacement (the "gate")
│   └── lock-in/         # tasks, prioritised — voice in, lock in
└── packages/            # (reserved) shared code, once extracted
```

Each `apps/<name>/` also carries its own **`README.md`** (what the app is) and **`CLAUDE.md`**
(technical context for Claude — auto-loaded when working in that folder; see the root `CLAUDE.md`).

## Apps

| App        | Folder            | What it is                             |
|------------|-------------------|----------------------------------------|
| Hub        | `apps/hub`        | Launcher that lists the apps           |
| Focus Gate | `apps/focus-gate` | Intentional Instagram replacement      |
| Lock In    | `apps/lock-in`    | Tasks, prioritised. Voice in, lock in. |

All apps share one Supabase project (Postgres schemas `hub`, `focus_gate`) and run on
the Vercel free tier. See `CLAUDE.md` for the full spec.

## Develop

Uses npm workspaces + Turborepo.

```bash
npm install                          # install all workspaces from the root
npm run dev                          # run every app (turbo)
npm run dev -- --filter=./apps/hub   # run a single app by folder
npm run build                        # build all
npm run lint                         # lint all
```

Per-app commands also work from inside each `apps/*` folder.

## Deploy

Each app is its own Vercel project pointing at this repo, with **Root Directory** set to
its `apps/<name>` folder. Configure each project's *Ignored Build Step* (e.g.
`npx turbo-ignore`) so a push only rebuilds the apps that actually changed. Production
ships from `main`; roll back via Vercel's deployment history.

> Migrated from the former standalone repos `focus-gate-personal-app` and
> `lock-in-personal-app`; their git history is preserved here under `apps/*`.
