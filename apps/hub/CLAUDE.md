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
- Extra npm scripts: `typecheck` (`tsc --noEmit`), `setup-vercel` (`scripts/setup-vercel-project.mjs`, bootstraps new Vercel projects — monorepo model: `--root-dir apps/<name>`, prod branch `main`, `turbo-ignore`), and `prebuild` (runs `scripts/sync-app-icons.mjs` + `scripts/validate-registry.mjs` before every build)
- Prod: `icefrosst-hub.vercel.app` (Vercel project `icefrosst-hub`, Root Directory `apps/hub`)

## Conventions
- The tile registry is `config/apps.json`, read via `src/lib/apps.ts` (`getApps()`, typed `AppDefinition`). Imported at **build time** — edit JSON, then redeploy.
- **Tiles are home-screen-style app icons** (`AppTile`): a rounded squircle + name label, no card/border/description — the grid reads like a phone folder. Each app's real PWA icon lives in `public/app-icons/<slug>.png` and is referenced by `iconImage` in `apps.json`, rendered via `next/image`.
- **`iconImage` is preferred; the Tabler `icon` is the fallback** when an app has no image (renders the glyph on a colored tile). Either way, **map every `icon` in `src/lib/icons.ts`** so the fallback is sensible.
- `color` must be one of the 8 palette names listed in the root `CLAUDE.md`.
- **Registry rules are build-enforced**: `prebuild` runs `scripts/validate-registry.mjs` (kebab-case slug, allowed color, icon mapped in `icons.ts`, `iconImage` file present, non-empty `versions.stable` — exit 1 names the slug and problem) and `scripts/sync-app-icons.mjs` (copies each sibling app's `public/icons/*-512.png` into `public/app-icons/<slug>.png` when bytes differ).
- The hub's own PWA icons are real PNGs in `public/icons/` (`hub-180/192/512.png` + `hub-512-maskable.png`), generated from `public/icon.svg` by `scripts/gen-icons.mjs` (sharp). The SVG stays as the regular favicon; `layout.tsx` points the apple-touch icon at `hub-180.png` (iOS doesn't render SVG apple-touch icons).
- Components: `AppGrid`/`AppTile` (grid), `HubHome`, `SignInLanding`/`SignInWithGoogle`/`SignOutButton`, `ServiceWorkerRegistrar`.

## Data model
- `hub.user_app_preferences (user_id, app_slug, preferred_version, updated_at)` — `supabase/sql/0001_hub_user_app_preferences.sql`. **Reserved, not used** — tiles always open `stable`. Kept in place per the additive-only rule.

## Gotchas
- Adding an app is **two steps**: edit `config/apps.json` **and** map its icon in `src/lib/icons.ts` — but a miss no longer ships silently: `validate-registry.mjs` fails the build. For the home-screen look, also set `iconImage`; without it the tile shows the Tabler glyph fallback.
- App icons in `public/app-icons/` are **copies** of each app's `public/icons/*-512.png`, kept fresh by `sync-app-icons.mjs` at build time. **Caveat:** on Vercel the Root Directory is `apps/hub`, so sibling app folders may be absent — the script then skips (never fails); the committed copies are what deploys, so commit the synced PNGs after a local/sandbox build.
- `apps.json` is build-time — a tile change needs a redeploy, not just a data edit.
- `src/` + legacy ESLint here vs. `app/` + flat config in the other apps — mind the difference when copying patterns between apps.

## Current state
Live and working: Google OAuth sign-in/landing, the app grid from `apps.json` (Focus Gate,
Lock In, Cookie Jar), PWA install, and service-worker registration. Deployed from `main`.
The grid is a **phone-folder look** — each app's real icon as a rounded squircle + name label
(`iconImage` in `apps.json` → `public/app-icons/<slug>.png`), no card chrome; Tabler glyph as
fallback. Audit fixes in: the auth callback sanitizes `next` (path-only redirect target), the
hub ships real PNG PWA icons (`public/icons/hub-*.png` from `gen-icons.mjs`; apple-touch is
the opaque 180), and `prebuild` validates the registry + syncs tile icons on every build.
Hub SQL: `0002_narrow_grants.sql` revokes `anon` from the `hub` schema (defense-in-depth).

## Next
- _Nothing queued yet. The reserved `hub.user_app_preferences` table is the obvious hook if/when you want a per-app version picker._
