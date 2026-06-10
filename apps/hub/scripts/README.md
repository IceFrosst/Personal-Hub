# `scripts/`

Build-time and bootstrap automation for the personal-apps portfolio. The bootstrap scripts run from cloud sessions; the `prebuild` scripts run automatically on every `next build`.

## `setup-vercel-project.mjs`

Creates a Vercel project for a new app in the **monorepo** model: links it to `Personal-Hub`, sets the production branch to `main`, sets the Root Directory (`apps/<name>`) and the `npx turbo-ignore` ignored build step, and injects the standard Supabase env vars.

### Prereqs

- The Vercel GitHub App must have access to `IceFrosst/Personal-Hub` (the easiest way: grant "All repositories" once at https://github.com/settings/installations).
- These env vars must be set in the session:
  - `VERCEL_TOKEN` — generated at https://vercel.com/account/tokens
  - `VERCEL_TEAM_ID` — find at https://vercel.com/account ("Your ID")
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — shared Supabase project

All personal secrets live in the Claude Code cloud env vars panel; they're available in every session.

### Run it

```bash
npm run setup-vercel -- --repo Personal-Hub --name icefrosst-<name> --prod-branch main --root-dir apps/<name>
```

Optional flags:
- `--prod-branch <name>` — production branch (default: `main`)
- `--root-dir <path>` — Root Directory inside the repo, e.g. `apps/<name>`
- `--github-owner <name>` — GitHub owner (default: `IceFrosst`)

### Output

One production URL once Vercel finishes the first build: `https://icefrosst-<name>.vercel.app`. Vercel assigns preview URLs per branch automatically — check the dashboard for the exact ones.

### Deployment model (monorepo)

There are **no** per-app `stable`/`previous` branches. All apps ship in lockstep from `main`; `config/apps.json` records each app's single production URL. Roll back via Vercel's deployment history (promote a previous deployment) — no branch juggling.

### Surrounding steps (Claude does these in-session, no separate script needed)

1. Scaffold the app under `apps/<name>` (it joins the workspace via the `apps/*` glob).
2. Add an entry to `config/apps.json` and map its icon in `src/lib/icons.ts`.
3. Push to `main` — Vercel deploys the new project.

## `gen-icons.mjs`

Rasterizes `public/icon.svg` into the hub's real PNG PWA icons in `public/icons/` (`hub-180.png` apple-touch on opaque `#161618`, `hub-192.png`, `hub-512.png`, and `hub-512-maskable.png` with the art at ~70% on a full-bleed background). iOS doesn't render SVG apple-touch icons, so the PNGs are committed. Re-run if `icon.svg` changes (`sharp` is hoisted at the repo root).

## `validate-registry.mjs` (prebuild)

Validates `config/apps.json` against the registry rules: kebab-case slugs, `color` in the 8-name palette, `icon` mapped in `src/lib/icons.ts`, `iconImage` files present under `public/`, and a non-empty `versions.stable`. Fails the build with a clear message naming the slug and problem. Takes an optional path argument to validate a different JSON file (used for testing).

## `sync-app-icons.mjs` (prebuild)

For each `apps.json` entry with an `iconImage`, copies the app's own `apps/<slug>/public/icons/*-512.png` into `public/app-icons/<slug>.png` when the bytes differ — no more hand-copying. On Vercel (Root Directory `apps/hub`) sibling app folders may be absent; the script logs a skip and exits 0 rather than failing the build.
