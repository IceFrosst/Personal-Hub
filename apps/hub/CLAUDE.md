# Hub — app context (`apps/hub`)

> Read the repo-root `CLAUDE.md` and `SCHEMA_RULES.md` first — they govern every app.
> **Keep `Current state` and `Next` (bottom) up to date — update them after every change to this app.**

The launcher PWA. Google sign-in, then a grid of tiles — one per app — read from
`config/apps.json`. Tapping a tile opens that app's production URL.

## Stack
- Next.js 15 (App Router, `next ^15.5.18`) + React 19 + TypeScript
- **`src/` layout** (`src/app`, `src/components`, `src/lib`) — differs from the other two apps, which use a top-level `app/`
- **Legacy ESLint** (`.eslintrc.json` + `next.config.js`) — also differs from the flat-config apps. Both differences are flagged for the structure pass (root `Next`).
- Tailwind 3 + Radix Colors, Tabler icons (`@tabler/icons-react`), Supabase SSR (Google OAuth)
- Extra npm scripts: `typecheck` (`tsc --noEmit`) and `setup-vercel` (`scripts/setup-vercel-project.mjs`, bootstraps new Vercel projects)
- Prod: `icefrosst-hub.vercel.app` (Vercel project `icefrosst-hub`, Root Directory `apps/hub`)

## Conventions
- The tile registry is `config/apps.json`, read via `src/lib/apps.ts` (`getApps()`, typed `AppDefinition`). Imported at **build time** — edit JSON, then redeploy.
- **Tiles are home-screen-style app icons** (`AppTile`): a rounded squircle + name label, no card/border/description — the grid reads like a phone folder. Each app's real PWA icon lives in `public/app-icons/<slug>.png` and is referenced by `iconImage` in `apps.json`, rendered via `next/image`.
- **`iconImage` is preferred; the Tabler `icon` is the fallback** when an app has no image (renders the glyph on a colored tile). Either way, **map every `icon` in `src/lib/icons.ts`** so the fallback is sensible.
- `color` must be one of the 8 palette names listed in the root `CLAUDE.md`.
- Components: `AppGrid`/`AppTile` (grid), `HubHome`, `SignInLanding`/`SignInWithGoogle`/`SignOutButton`, `ServiceWorkerRegistrar`.

## Data model
- `hub.user_app_preferences (user_id, app_slug, preferred_version, updated_at)` — `supabase/sql/0001_hub_user_app_preferences.sql`. **Reserved, not used** — tiles always open `stable`. Kept in place per the additive-only rule.

## Gotchas
- Adding an app is **two steps**: edit `config/apps.json` **and** map its icon in `src/lib/icons.ts`. For the home-screen look, also drop the app's real icon at `public/app-icons/<slug>.png` and set `iconImage`; without it the tile shows the Tabler glyph fallback.
- App icons in `public/app-icons/` are **copies** of each app's `public/icons/*-512.png`. If an app's icon changes, re-copy it here (build-time asset, needs redeploy).
- `apps.json` is build-time — a tile change needs a redeploy, not just a data edit.
- `src/` + legacy ESLint here vs. `app/` + flat config in the other apps — mind the difference when copying patterns between apps.

## Current state
Live and working: Google OAuth sign-in/landing, the app grid from `apps.json` (Focus Gate +
Lock In), PWA install, and service-worker registration. Deployed from `main`. The grid is a
**phone-folder look** — each app's real icon as a rounded squircle + name label (`iconImage`
in `apps.json` → `public/app-icons/<slug>.png`), no card chrome; Tabler glyph as fallback.

## Next
- _Nothing queued yet. The reserved `hub.user_app_preferences` table is the obvious hook if/when you want a per-app version picker._
