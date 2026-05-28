# Personal app portfolio — hub repo

This is **Ignas's personal app portfolio**. This repo is the **hub** — a launcher that lists every app I've built and lets me (and friends I share with) pick which version of each to open. Each "app" is a separate GitHub repo, with its own Vercel deployment, listed here as a tile.

> Read this whole file before doing anything. The rules below are not suggestions — they are the project's spine.

---

## Who and what

- **User:** Ignas (`ign3107s@gmail.com`), GitHub `icefrosst`.
- **Workflow:** Everything happens in Claude Code on the web. **No local dev.** Code is pushed from cloud sessions, Vercel auto-deploys, Ignas tests on the live URL.
- **Goal:** Ship PWAs fast and iterate. Each app should be shippable in 1–2 sessions. The hub lists them.
- **Hard constraint: 100% free to run.** Vercel free tier + Supabase free tier. If a request would require ANY other paid service, **stop and flag it before implementing.**

---

## The four iron rules — never violate

### 1. No hardcoded URLs anywhere except `config/apps.json`
All cross-app and hub→app URLs live in that one file. This makes a future custom-domain migration a single-file diff. If you find yourself typing `vercel.app` in any code file other than `config/apps.json`, stop.

### 2. Schema is additive — forever
Add columns / tables / JSON fields. **Never rename, never delete, never narrow a type.** Users running older versions of an app must always be able to read/write data created by newer versions. Every app repo gets a `SCHEMA_RULES.md`; check it before any migration.

### 3. One Supabase project for all apps
Namespace tables per app via Postgres schemas: `focus_gate.tasks`, `workout.sessions`, etc. One Google login covers the whole portfolio. Never create a new Supabase project for a new app.

### 4. Row Level Security on every user-data table
Users can only `SELECT/INSERT/UPDATE/DELETE` rows where `user_id = auth.uid()`. Every user-data table has `user_id uuid references auth.users not null` and RLS enabled. No exceptions.

---

## Stack — non-negotiable

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + Radix Colors (dark mode only)
- **PWA:** Every app AND the hub are installable PWAs (manifest + service worker)
- **Hosting:** Vercel free tier, `icefrosst-*` project names
- **Backend:** Supabase (Postgres + Auth) free tier — one shared project, Google OAuth
- **Code:** GitHub, one repo per app + this hub repo
- **Icons:** Tabler icons — map icon-name strings to Tabler components in code
- **Auth:** Google OAuth via Supabase, single account covers the whole portfolio

---

## Architecture

Each app = its own Next.js repo + its own Vercel project + its own `*.vercel.app` URL. Apps are independent — one breaking doesn't affect others. The hub just reads `config/apps.json` and renders tiles.

### Three live versions per app

| Branch | Role | URL pattern |
|--------|------|-------------|
| `stable` | Default for users | `icefrosst-{slug}.vercel.app` |
| `previous` | Rollback safety net | `icefrosst-{slug}-git-previous-icefrosst.vercel.app` |
| `main` | Experimental / bleeding edge | `icefrosst-{slug}-git-main-icefrosst.vercel.app` |

Confirm the exact Vercel-generated URLs after first deploy and use those in `config/apps.json`.

### `config/apps.json` — schema and live example

```json
{
  "apps": [
    {
      "slug": "focus-gate",
      "name": "Focus Gate",
      "description": "Intentional Instagram replacement",
      "icon": "brain",
      "color": "purple",
      "versions": {
        "stable": "https://icefrosst-focus-gate-personal-app.vercel.app",
        "previous": "https://icefrosst-focus-gate-personal-app-git-previous-icefrosst.vercel.app",
        "experimental": "https://icefrosst-focus-gate-personal-app-git-main-icefrosst.vercel.app"
      },
      "added_at": "2026-05-27"
    }
  ]
}
```

Field rules: `slug` is kebab-case and matches the repo name prefix. `icon` is a Tabler icon name (no `Icon` prefix). `color` is one of: `coral`, `teal`, `purple`, `amber`, `blue`, `pink`, `green`, `gray`.

### Hub-specific Supabase tables

In a `hub` schema: `hub.user_app_preferences` — `(user_id uuid, app_slug text, preferred_version text)` — remembers each user's preferred version per app.

---

## Visual style — applies to the hub AND every app

### Mode
**Dark mode only.** No light mode, no system toggle.

### Color foundation — Radix Colors

Use the [Radix Colors](https://www.radix-ui.com/colors) palette (`@radix-ui/colors`). Import dark variants only. **Step semantics:** 1–2 = page backgrounds · 3–5 = UI element backgrounds · 6–8 = borders · 9–10 = solid backgrounds · 11–12 = text.

**Neutral base: `mauve`** — import `@radix-ui/colors/mauve-dark.css`.

| Token | Radix var | Hex |
|-------|-----------|-----|
| Background | `--mauve-1` | `#161618` |
| Surface | `--mauve-3` | `#232326` |
| Surface elevated | `--mauve-4` | `#28282c` |
| Border subtle | `--mauve-6` | `#3a3a3f` |
| Border focus | `--mauve-8` | `#504f57` |
| Text low | `--mauve-9` | `#7e7d86` |
| Text muted | `--mauve-11` | `#a09fa6` |
| Text | `--mauve-12` | `#ededef` |

### Accent palette

| Name | Radix scale | Hex |
|------|-------------|-----|
| `coral` | `red` | `#e5484d` |
| `teal` | `teal` | `#12a594` |
| `purple` | `purple` | `#8e4ec6` |
| `amber` | `amber` | `#ffb224` |
| `blue` | `blue` | `#0090ff` |
| `pink` | `pink` | `#d6409f` |
| `green` | `green` | `#30a46c` |
| `gray` | `mauve` step 7 | `#46464d` |

In `tailwind.config.ts`:

```ts
colors: {
  bg: 'var(--mauve-1)',
  surface: 'var(--mauve-3)',
  'surface-elevated': 'var(--mauve-4)',
  border: 'var(--mauve-6)',
  'border-focus': 'var(--mauve-8)',
  'text-low': 'var(--mauve-9)',
  'text-muted': 'var(--mauve-11)',
  text: 'var(--mauve-12)',
  coral: 'var(--red-9)',
  teal: 'var(--teal-9)',
  purple: 'var(--purple-9)',
  amber: 'var(--amber-9)',
  blue: 'var(--blue-9)',
  pink: 'var(--pink-9)',
  green: 'var(--green-9)',
  gray: 'var(--mauve-7)',
}
```

### Typography
- **Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif` (SF Pro on iOS, Roboto on Android)
- Page title: `text-2xl font-semibold` · Section: `text-lg font-medium` · Body: `text-base` · Caption: `text-sm` · Label: `text-xs uppercase tracking-wide`

### Spacing & shape
- 4px grid (Tailwind defaults). Page padding: `px-4 py-6` mobile, `px-6 py-8` tablet+.
- Buttons/inputs: `rounded-md` · Cards: `rounded-2xl` · Modal sheets: `rounded-t-3xl` top edge only
- No decorative shadows. Floating UI only: `shadow-[0_8px_24px_rgba(0,0,0,0.5)]` + `border-white/10`

### Motion
- Colors/hover: `transition-colors duration-150 ease-out`
- Layout: `transition-all duration-200 ease-out`
- No spring physics. Crisp and fast.

### Touch & platform polish (non-negotiable)
- Min touch target: 44×44px (`min-h-11 min-w-11`)
- `-webkit-tap-highlight-color: transparent` globally
- `-webkit-text-size-adjust: 100%` on `<html>`
- Safe areas: `env(safe-area-inset-*)` on every full-screen layout
- `100dvh` not `100vh`
- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`
- `appearance: none` on all form elements

### PWA
- `theme-color`: `#161618`
- `apple-mobile-web-app-status-bar-style`: `black-translucent`
- `manifest.json`: `display: standalone`, `background_color: #161618`
- Icons: Tabler, 20–24px, `stroke-width: 1.5`
- Design viewport: Pixel 8 (412px). Verify at iPhone SE (375px).

---

## Supabase project (`icefrosst-apps`)

One shared project for the whole portfolio (iron rule #3). Region: Europe. Project ref: `qcsyihymmaktkbqfxlkl`.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are in the session env vars and are injected automatically into every Vercel project by the setup script. The anon key is public by design (RLS gates every query). The `service_role` key and DB password are never in app code — Ignas's password manager only.

---

## Session env vars — all keys

All set in the Claude Code cloud env vars panel. Available every session.

### `GITHUB_TOKEN`
- GitHub Personal Access Token (classic), scopes: `repo` + `workflow`
- Used by the GitHub MCP server for all git operations
- Renew: github.com → Settings → Developer settings → Personal access tokens
- Set to no expiration; update here if you add a date

### `VERCEL_TOKEN`
- Vercel API token
- Used by `scripts/setup-vercel-project.mjs`
- Renew: vercel.com → Settings → Tokens
- Requires `api.vercel.com` in the network allowlist

### `VERCEL_TEAM_ID`
- Vercel account/team ID — scopes API calls
- Find: vercel.com → Settings → General → Your ID
- Never changes

### `SUPABASE_ACCESS_TOKEN`
- Supabase Personal Access Token — Supabase Management API
- Used to run SQL migrations and set auth redirect URLs
- Renew: supabase.com → avatar → Account → Access Tokens
- Requires `api.supabase.com` in the network allowlist
- Do not commit anywhere

### `NEXT_PUBLIC_SUPABASE_URL`
- URL of the shared Supabase project. Never changes.
- Injected into every Vercel project automatically by the setup script

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Public anon key. Safe in client bundles (RLS enforces access).
- Injected into every Vercel project automatically by the setup script
- Renew only if regenerated: supabase.com → project → Settings → API

### `GEMINI_API_KEY`
- Google AI Studio key, project `icefrosst-apps`
- Model: `gemini-2.0-flash` — free tier: 15 req/min, 1,500 req/day
- Renew: aistudio.google.com → Get API key
- **Must be added manually to each Vercel project that uses AI** — setup script only injects Supabase vars
- Call server-side only. Always write a graceful fallback. Use `generationConfig: { responseMimeType: 'application/json' }` for structured output.

### Network allowlist

Add these to the outbound allowlist in Claude Code environment settings:
- `api.vercel.com` — needed for Vercel project creation
- `api.supabase.com` — needed for SQL migrations and auth config

---

## Full automation — new app checklist

With all tokens set and both domains allowlisted, Claude does all of this without manual steps:

1. ✅ **GitHub repo** — `mcp__github__create_repository`
2. ✅ **Code scaffold** — `mcp__github__push_files` to `main` (Next.js 15, Tailwind, Supabase SSR, PWA)
3. ✅ **Branches** — `stable` and `previous` from `main`
4. ✅ **Vercel project** — `node scripts/setup-vercel-project.mjs --repo <repo> --name icefrosst-<repo>`
5. ✅ **SQL migration** — `POST https://api.supabase.com/v1/projects/qcsyihymmaktkbqfxlkl/database/query`
6. ✅ **Auth redirect URL** — `PATCH https://api.supabase.com/v1/projects/qcsyihymmaktkbqfxlkl/config/auth`
7. ✅ **apps.json** — entry added to hub via GitHub MCP

**Still manual:** add `GEMINI_API_KEY` in Vercel dashboard + test on phone.

---

## Bootstrap automation (`scripts/`)

### `scripts/setup-vercel-project.mjs`

Creates a Vercel project, links it to its GitHub repo, sets `stable` as production, injects Supabase env vars from session env. Usage:

```bash
node scripts/setup-vercel-project.mjs --repo focus-gate-personal-app --name icefrosst-focus-gate-personal-app
```

---

## Workflow rules

- **Never push directly to `main` of the hub repo without confirmation.**
- **App repos: three permanent branches** — `stable`, `previous`, `main`. New work on `main`; promote to `stable` only when confirmed; copy old `stable` to `previous` first.
- **Commit messages say why, not just what.**

---

## When asked to ADD A NEW APP — discovery first

Do **not** start building until the app is understood. Ask one question at a time with `AskUserQuestion`, picking whichever resolves the biggest remaining ambiguity:

- **The problem** — one sentence
- **Minimum shape** — simplest useful version; what's v2?
- **Core actions** — what does the user DO? (2–3 verbs)
- **Data model** — tables, columns. Confirm before any schema work — it's additive forever
- **Audience** — just Ignas, or shared?
- **Offline?** — affects PWA/SW design
- **External APIs** — must be free tier
- **Identity** — slug, Tabler icon, palette color (lock last)

Summarise in 5–10 bullets and wait for thumbs-up. Then follow the **Full automation checklist** above.

---

## When asked to MODIFY AN EXISTING APP

That work belongs in the app's own repo. The only changes that belong here:
- Adding/editing `config/apps.json`
- Hub bugs and features
- Editing this `CLAUDE.md`

---

## What I want from you

- **Concise.** No wall of text for small changes.
- **Ask, don't assume.** Especially on data model and anything user-visible.
- **Flag iron-rule conflicts loudly.**
- **Flag paid services immediately.** Free tier or bust.
- **No speculative abstractions.** Build what's in front of you.
- **Mobile-first, always.**

---

## How to actually build — failure modes to resist

### Don't agree just because I said it
Verify before agreeing. If I'm wrong, push back with the reason. Sycophancy lets bad patches ship.

### Fix root causes, never symptoms
- Don't delete the feature to fix its bug
- Don't silence errors with try/catch
- Don't work around a wrong assumption instead of fixing it
- Third time fixing the same bug = wrong diagnosis; re-architect

### Self-monitor for losing the plot
Signs: patching the same file three times, re-discovering things already known, hand-wavy output. When noticed: stop, commit what's stable, re-anchor or split to a fresh session.

---

## Current phase

**Focus Gate shipped (first app).** Code is complete and pushed to GitHub — `main`, `stable`, and `previous` branches all exist in `icefrosst/focus-gate-personal-app`.

**Pending — blocked by network policy:**
- Vercel project creation (`api.vercel.com` not yet allowlisted)
- SQL migration (`api.supabase.com` not yet allowlisted)

To unblock: add `api.vercel.com` and `api.supabase.com` to the outbound allowlist in Claude Code environment settings. After that, both steps run automatically and the app will be live.

Once Focus Gate is live and confirmed working, the full automation loop is proven and new apps can go from idea to live URL without any manual steps (except adding app-specific secrets in Vercel and testing on phone).
