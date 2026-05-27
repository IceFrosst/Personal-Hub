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

### 1. No hardcoded URLs anywhere except `hub/config/apps.json`
All cross-app and hub→app URLs live in that one file. This makes a future custom-domain migration a single-file diff. If you find yourself typing `vercel.app` in any code file other than `config/apps.json`, stop.

### 2. Schema is additive — forever
Add columns / tables / JSON fields. **Never rename, never delete, never narrow a type.** Users running older versions of an app must always be able to read/write data created by newer versions. This rule applies for the entire lifetime of the project. Every app repo gets a `SCHEMA_RULES.md` documenting this; check it before any migration.

### 3. One Supabase project (`icefrosst-apps`) for all apps
Namespace tables per app via Postgres schemas: `workout.sessions`, `hydration.logs`, `notes.entries`, etc. One Google login covers the whole portfolio. Never create a new Supabase project for a new app.

### 4. Row Level Security on every user-data table
Policy template (no exceptions): users can only `SELECT/INSERT/UPDATE/DELETE` rows where `user_id = auth.uid()`. Every table that holds user data has a `user_id uuid references auth.users not null` column and RLS enabled before it sees real data.

---

## Stack — non-negotiable

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **PWA:** Every app AND the hub are installable PWAs (manifest + service worker)
- **Hosting:** Vercel free tier, `icefrosst-*` URL prefix
- **Backend:** Supabase (Postgres + Auth) free tier — one shared project, Google OAuth
- **Code:** GitHub, one repo per app + this hub repo
- **Icons:** Tabler icons (free, large set) — map an icon-name string to the Tabler component in code
- **Auth:** Google OAuth via Supabase, single Google account covers the portfolio

---

## Architecture

- Each app = **its own Next.js repo** + its own Vercel project + its own `*.vercel.app` URL.
- Every personal-app repo gets the GitHub topic **`personal-apps`** so they list and filter together. (GitHub has no native "folder" for repos; the topic is how we group.)
- Apps are **independent** — one breaking doesn't affect others.
- The hub is **just a launcher.** It reads `config/apps.json`, renders tiles, lets the user pick a version, opens it in a new tab.

### Three live versions per app (via Git branches → Vercel branch deployments)

| Branch       | Role          | URL pattern                                                   |
| ------------ | ------------- | ------------------------------------------------------------- |
| `stable`     | Default for users      | `icefrosst-{slug}.vercel.app`                        |
| `previous`   | Rollback safety net    | `icefrosst-{slug}-git-previous-icefrosst.vercel.app` |
| `main`       | Experimental / bleeding edge | `icefrosst-{slug}-git-main-icefrosst.vercel.app` |

> The exact `-git-{branch}-{owner}.vercel.app` form is what Vercel generates by default — confirm the literal URL Vercel gives you on the first deploy and use THAT in `config/apps.json`.

### `config/apps.json` schema

```json
{
  "apps": [
    {
      "slug": "workout",
      "name": "Workout tracker",
      "description": "Lifts, sets, PRs",
      "icon": "barbell",
      "color": "coral",
      "versions": {
        "stable": "https://icefrosst-workout.vercel.app",
        "previous": "https://icefrosst-workout-git-previous-icefrosst.vercel.app",
        "experimental": "https://icefrosst-workout-git-main-icefrosst.vercel.app"
      },
      "added_at": "YYYY-MM-DD"
    }
  ]
}
```

### Hub-specific Supabase tables

In a `hub` schema:
- `hub.user_app_preferences` — `(user_id uuid, app_slug text, preferred_version text)` — remembers each user's default version choice per app.

---

## Visual style — applies to the hub AND every app

### Mode
**Dark mode only.** No light mode, no system toggle.

### Color foundation — Radix Colors

Use the [Radix Colors](https://www.radix-ui.com/colors) palette (`npm install @radix-ui/colors`). Purpose-built for app UI with proper dark-mode tuning and accessibility pre-tested per step. **Step semantics:** 1–2 = page backgrounds · 3–5 = UI element backgrounds (rest → hover → active) · 6–8 = borders (subtle → focus) · 9–10 = solid backgrounds (rest → hover) · 11–12 = text (low → high contrast). Stick to these conventions when picking shades.

**Neutral scale: `mauve`** (subtle warm tint, complements every accent). Import `@radix-ui/colors/mauve-dark.css`.

| Token | Radix var | Approx. hex |
| ----- | --------- | ----------- |
| Background base | `--mauve-1` | `#161618` |
| Surface (cards, tiles, panels) | `--mauve-3` | `#232326` |
| Surface elevated (modals, popovers) | `--mauve-4` | `#28282c` |
| Border subtle | `--mauve-6` | `#3a3a3f` |
| Border focus | `--mauve-8` | `#504f57` |
| Text low / disabled | `--mauve-9` | `#7e7d86` |
| Text medium | `--mauve-11` | `#a09fa6` |
| Text high emphasis | `--mauve-12` | `#ededef` |

### Accent palette (for app tiles and per-app theming)

The `color` field in `apps.json` picks one of these. Each name maps to a Radix scale at **step 9** (solid background). Foreground follows Radix's contrasted-text rule per scale (amber needs a dark foreground; the rest take white).

| Name     | Radix scale | Step 9 hex | Icon / text on tile |
| -------- | ----------- | ---------- | ------------------- |
| `coral`  | `red`       | `#e5484d`  | white               |
| `teal`   | `teal`      | `#12a594`  | white               |
| `purple` | `purple`    | `#8e4ec6`  | white               |
| `amber`  | `amber`     | `#ffb224`  | `--mauve-1` (dark)  |
| `blue`   | `blue`      | `#0090ff`  | white               |
| `pink`   | `pink`      | `#d6409f`  | white               |
| `green`  | `green`     | `#30a46c`  | white               |
| `gray`   | `mauve`     | `#46464d` (step 7) | white       |

Import the dark variants only: `@radix-ui/colors/{red,teal,purple,amber,blue,pink,green,mauve}-dark.css`.

In `tailwind.config.js`, alias the names so `bg-coral` / `text-coral` work in JSX:

```js
theme: {
  extend: {
    colors: {
      // surfaces
      bg: 'var(--mauve-1)',
      surface: 'var(--mauve-3)',
      'surface-elevated': 'var(--mauve-4)',
      border: 'var(--mauve-6)',
      'border-focus': 'var(--mauve-8)',
      'text-low': 'var(--mauve-9)',
      'text-muted': 'var(--mauve-11)',
      text: 'var(--mauve-12)',
      // accents
      coral: 'var(--red-9)',
      teal: 'var(--teal-9)',
      purple: 'var(--purple-9)',
      amber: 'var(--amber-9)',
      blue: 'var(--blue-9)',
      pink: 'var(--pink-9)',
      green: 'var(--green-9)',
      gray: 'var(--mauve-7)',
    },
  },
},
```

### Typography
- **Font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif`. Renders as **SF Pro on iOS, Roboto on Android**, system sans on desktop. Native feel without shipping a custom font.
- **Scale** (Tailwind classes):
  - Hero / page title — `text-2xl font-semibold`
  - Section heading — `text-lg font-medium`
  - Body — `text-base`
  - Caption / secondary — `text-sm` + medium-emphasis color
  - Micro / labels — `text-xs uppercase tracking-wide`

### Spacing
4px grid via Tailwind defaults. Default page padding: `px-4 py-6` on mobile, `px-6 py-8` on tablet+.

### Border radius
- Buttons, inputs, chips: `rounded-md` (6px)
- Cards, tiles, sheets: `rounded-2xl` (16px)
- Modal full sheets: `rounded-t-3xl` (24px) on top edge only
- Avoid `rounded-full` except for genuinely circular elements (avatars, status dots)

### Elevation
No decorative shadows. The single exception: floating UI (dropdowns, popovers, toasts) uses `shadow-[0_8px_24px_rgba(0,0,0,0.5)]` plus a 1px highlight border `border-white/10` to lift it against the dark background — that's usability, not decoration.

### Motion
- Colors / hover / press: `transition-colors duration-150 ease-out`
- Layout: `transition-all duration-200 ease-out`
- Modal/sheet enter: 250ms slide-up from bottom (mobile) / fade (desktop)
- No bouncy spring physics. Crisp, fast, exit-quickly.

### Touch and platform polish (non-negotiable for native feel on both iPhone and Pixel)
- **Min touch target:** 44×44px. Use `min-h-11 min-w-11` on tap-only elements.
- **Disable iOS tap highlight:** `-webkit-tap-highlight-color: transparent` globally.
- **Disable iOS text-size auto-adjust:** `-webkit-text-size-adjust: 100%` on `<html>`.
- **Safe areas:** every full-screen layout respects `env(safe-area-inset-top/bottom/left/right)`. Critical for iPhone home indicators, notches, Dynamic Island, AND Pixel 8 gesture nav.
- **Use `100dvh`** not `100vh` for full-height layouts (correct on dynamic mobile viewports — browser chrome / keyboard collapse).
- **Viewport meta:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` — edge-to-edge.
- **Reset native form styling on iOS:** `appearance: none` on `<input>`, `<select>`, `<button>` (iOS Safari otherwise over-styles them).
- **Momentum scrolling** on scrollable containers: `-webkit-overflow-scrolling: touch`.

### PWA chrome (per-app AND hub)
- `<meta name="theme-color" content="#161618">` → Android status bar blends into the app background (matches `--mauve-1`).
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` → iOS status bar overlays content edge-to-edge.
- `manifest.json`: `"display": "standalone"`, `"background_color": "#161618"`, `"theme_color": "#161618"`.

### Icons
Tabler icons only. Default 20px or 24px, `stroke-width: 1.5`. Tint via `text-{color}`.

### Viewport targets
Design at **Pixel 8 width (412px CSS)** first. Verify nothing breaks at **iPhone SE width (375px)** — the smallest mainstream target. Scale gracefully to tablet (768px+) and desktop, but the polish target is mobile.

---

## Supabase project (`icefrosst-apps`)

The one shared project for the whole portfolio (iron rule #3). Region: Europe. Created from `ign3107s@gmail.com`. `Enable automatic RLS` is on at the project level so every new table gets RLS by default — never disable that.

**Project ref:** `qcsyihymmaktkbqfxlkl` — appears in dashboard URLs, e.g. `https://supabase.com/dashboard/project/qcsyihymmaktkbqfxlkl/sql/new` for the SQL editor.

**Env vars to paste into every Vercel project** (same values for hub AND every app, since one shared Supabase project):

```env
NEXT_PUBLIC_SUPABASE_URL=https://qcsyihymmaktkbqfxlkl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjc3lpaHltbWFrdGticWZ4bGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTI0MTAsImV4cCI6MjA5NTM2ODQxMH0.VbFjbjtPjhD36NE9Fhi4Sgcb8WbE8DU7AsLtTQs6J-8
```

- The anon key is **public by design** (RLS gates every query); safe in client bundles, safe in this file.
- The `service_role` key is NEVER used in app code and never committed anywhere — lives only in Ignas's password manager.
- The DB password lives only in Ignas's password manager — not needed for app code.

---

## Full automation — env vars & network policy

When the four session env vars below are set **and** the network policy allows outbound to `api.vercel.com` and `api.supabase.com`, building a new app is fully hands-off from idea to live URL. No manual dashboard steps.

### Session env vars (set in the Claude Code cloud env vars panel)

| Var | What it unlocks |
|-----|-----------------|
| `GITHUB_TOKEN` | Creating repos, pushing code, branches, updating files — via GitHub MCP |
| `VERCEL_TOKEN` | Creating Vercel projects, linking GitHub repos, setting production branch, injecting env vars |
| `VERCEL_TEAM_ID` | Scopes all Vercel API calls to the correct team |
| `SUPABASE_ACCESS_TOKEN` | Running SQL migrations + updating auth redirect URLs — via Supabase Management API. Get it at: supabase.com → avatar → Account → Access Tokens |

**All four are already set in the environment.**

### Network policy — add these two domains to the outbound allowlist

In the Claude Code environment settings (same place as env vars), add to the network allowlist:
- `api.vercel.com`
- `api.supabase.com`

GitHub is already allowed (GitHub MCP server requires it).

### Complete new-app automation checklist

With tokens + network policy in place, Claude does **all** of this without any manual steps:

1. ✅ **GitHub repo** — created via GitHub MCP
2. ✅ **Code scaffold** — pushed to `main` via GitHub MCP (24+ files: Next.js, Tailwind, Supabase, PWA)
3. ✅ **Branches** — `stable` and `previous` created from `main`
4. ✅ **Vercel project** — created via `scripts/setup-vercel-project.mjs`: linked to GitHub, `stable` as production, Supabase env vars injected automatically
5. ✅ **SQL migration** — run via `POST https://api.supabase.com/v1/projects/qcsyihymmaktkbqfxlkl/database/query`
6. ✅ **Auth redirect URL** — added via `PATCH https://api.supabase.com/v1/projects/qcsyihymmaktkbqfxlkl/config/auth`
7. ✅ **apps.json** — entry added to hub repo via GitHub MCP

### What will never be automated

- **App-specific third-party API keys** (Gemini, etc.) — secrets only Ignas holds; must be added manually in the Vercel project dashboard after creation
- **Testing on phone** — the whole point; a human needs to verify the live URL

---

## Bootstrap automation (`scripts/`)

For the "speak idea into existence" flow, repetitive setup is scripted.

### `scripts/setup-vercel-project.mjs`

Creates a Vercel project for a new app, links it to its GitHub repo, sets `stable` as production branch, pastes the Supabase env vars. Requires `VERCEL_TOKEN` + `VERCEL_TEAM_ID` in env (set in the Claude Code cloud env vars panel — already done).

```bash
npm run setup-vercel -- --repo focus-gate-personal-app --name icefrosst-focus-gate-personal-app
```

See `scripts/README.md` for full docs.

---

## Workflow rules

- **Never push directly to `main` of the hub repo without my confirmation.** Open feature branches; ask for permission to ship when we test that it works. 
- **App repos use three permanent branches:** `stable`, `previous`, `main`. Treat them as deploy targets, not feature branches. New work lands on `main` first; promote to `stable` only when I confirm; copy old `stable` to `previous` before overwriting.
- **Commit early, commit clear.** Each commit message says *why*, not just *what*.
- **PR descriptions** include the live preview URL once Vercel deploys it, so I can test on phone.

---

## When I ask to ADD A NEW APP — discovery FIRST, code SECOND

Do **NOT** start scaffolding or writing code until you genuinely understand the app. Use the `AskUserQuestion` tool to ask **one question at a time**, picking each question to resolve the biggest remaining ambiguity given what I've already told you.

**There is no fixed number of questions. Ask as many or as few as you actually need. 

Areas typically worth probing — **not a checklist**, only touch what's still unclear:

- **The problem.** What does this solve, in one sentence?
- **The minimum viable shape.** What's the simplest version that's still useful? What can wait until v2?
- **Core actions.** What does the user actually DO in the app? (Usually 2–3 verbs.)
- **Data.** What gets stored? Sketch the model — tables, columns, JSON shapes. **Confirm before any schema work, because schema is additive-only forever.**
- **Audience.** Just me, or shared with friends? Affects RLS, sharing model, sometimes data shape.
- **Connectivity.** Online-only or does offline matter? Affects PWA / service worker design.
- **External APIs.** Anything needed? Confirm it's free and tolerant of free-tier rate limits.
- **Identity bits.** Slug, Tabler icon name, color from the palette. Lock LAST, once the app's shape is clear.

When you're done probing, **summarize back to me in 5–10 bullets and wait for a thumbs-up.** Only then start building.

When `TEMPLATE.md` exists in this repo, follow it for the mechanical scaffolding (new GitHub repo + Vercel project + branches + Supabase schema + entry in `apps.json`). It does not exist yet — it will be created **after** the first app ships, once the pattern is real and not guessed.

---

## When I ask to MODIFY AN EXISTING APP

That work belongs in **that app's own repo**, not this hub repo. Tell me to open a new session against the right repo. The only modifications that belong here:

- Adding/editing an entry in `config/apps.json` (new app, new version URL, renamed app).
- Hub-itself bugs and features.
- Editing this CLAUDE.md or the eventual TEMPLATE.md.

---

## When I ask anything else

Even for small features, do a mini-discovery before coding:
- What does "done" look like?
- Is there a simpler way that gets 80% of the value?
- Does this conflict with any iron rule?

Ask one targeted question rather than guessing. 30 seconds of clarification saves an hour of rework.

---

## What I want from you

- **Be concise.** I don't want a wall of text for a small change.
- **Ask, don't assume.** Especially on data model, naming, and anything user-visible.
- **Flag iron-rule conflicts loudly.** If a request would violate rule 1–4, stop and raise it.
- **Flag any paid-service implication immediately.** Free tier or bust.
- **No speculative abstractions.** Build the thing in front of you. Refactor only when a second use case actually exists.
- **Mobile-first, always.**

---

## How to actually build — failure modes to actively resist

These are things AI coding agents default to. Override them.

### Don't agree just because I said it
If I say "this is a hack," "this is broken," or "you're wrong" — **verify before agreeing.** Read the actual code. If I'm right, agree and fix it. **If I'm wrong, push back plainly with the reason.** Sycophantic "you're right, sorry" wastes my time and lets bad patches ship. You are more useful as an honest second opinion than a yes-machine. The same applies to product direction within a session: if I push toward a design choice that contradicts something we agreed earlier, surface the contradiction.

### Fix root causes, never paper over symptoms
When a bug appears the question is **why**, not "how do I make this symptom disappear." Specifically forbidden:
- Deleting the feature to "fix" its bug.
- Wrapping errors in `try`/`catch` (or equivalent) to silence them.
- Adding conditionals that work around a wrong assumption elsewhere instead of fixing the assumption.
- "Fixing" the same bug a third time — that means the diagnosis is wrong; stop patching and re-architect that area.

When a real fix is meaningfully more work than a patch, **surface the trade-off explicitly** ("quick patch is 3 lines; root cause is X and needs Y — which?") rather than silently choosing the patch.

### Self-monitor for losing the plot
Long sessions in large codebases degrade. Signs you're losing the plot: patching the same file three times, fixing the same bug repeatedly, output starts to feel hand-wavy, you're re-discovering things you already knew this session. When you notice it: **stop, commit what's stable, and propose either re-anchoring on the goal or splitting the work into a fresh session.** Don't wait for me to catch it.

---

## Current phase

**Phase 1 — Bootstrap.** Setting up Supabase, building the hub, building the first real app (workout tracker) as the pattern-establisher. See the original spec discussed in session for the step-by-step. Once the first app is live and `TEMPLATE.md` exists, new apps should be 20-minute conversations.
