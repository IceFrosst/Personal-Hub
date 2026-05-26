# Personal app portfolio — hub repo

This is **Ignas's personal app portfolio**. This repo is the **hub** — a launcher that lists every app I've built and lets me (and friends I share with) pick which version of each to open. Each "app" is a separate GitHub repo, with its own Vercel deployment, listed here as a tile.

> Read this whole file before doing anything. The rules below are not suggestions — they are the project's spine.

---

## Who and what

- **User:** Ignas (`ign3107s@gmail.com`), GitHub `icefrosst`. Primarily on a Pixel 8; PC for deep work.
- **Workflow:** Everything happens in Claude Code on the web. **No local dev.** Code is pushed from cloud sessions, Vercel auto-deploys, Ignas tests on the live URL.
- **Goal:** A growing set of small, useful PWAs that solve real problems. Each app should be shippable in 1–2 sessions. The hub lists them.
- **Hard constraint: 100% free to run.** Vercel free tier + Supabase free tier. The only acceptable future cost is ~$12/year for a custom domain. If a request would require ANY other paid service, **stop and flag it before implementing.**

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

- Clean, flat, minimal.
- White surfaces, **0.5px borders**, generous whitespace.
- **No gradients. No shadows.**
- Mobile-first (Pixel 8 viewport — design for that first, then scale up).
- Color palette is fixed — pick `color` for each app/tile from exactly this set:
  `coral`, `teal`, `purple`, `amber`, `blue`, `pink`, `green`, `gray`.
- Tabler icons only.

---

## Environment variables (for context — Ignas doesn't need to set anything in cloud sessions)

- Each app's deployed code needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- These live in **Vercel's project settings** (per Vercel project, one-time setup). Both values are the same across all apps since they all share one Supabase project.
- The anon key is public-by-design (gated by RLS); it's safe in client bundles.
- The `service_role` key is NEVER used in app code and never committed anywhere.

---

## Workflow rules

- **Never push directly to `main` of the hub repo without my confirmation.** Open feature branches; I'll merge.
- **App repos use three permanent branches:** `stable`, `previous`, `main`. Treat them as deploy targets, not feature branches. New work lands on `main` first; promote to `stable` only when I confirm; copy old `stable` to `previous` before overwriting.
- **Commit early, commit clear.** Each commit message says *why*, not just *what*.
- **PR descriptions** include the live preview URL once Vercel deploys it, so I can test on phone.

---

## When I ask to ADD A NEW APP — discovery FIRST, code SECOND

Do **NOT** start scaffolding or writing code until you genuinely understand the app. Use the `AskUserQuestion` tool to ask **one question at a time**, picking each question to resolve the biggest remaining ambiguity given what I've already told you.

**There is no fixed number of questions. Ask as many or as few as you actually need. Stop when — and only when — you could write a 5–10 bullet plan that I'd thumbs-up without edits.** If my opening description already answers something, don't ask it again as ritual. If after ten questions you're still unclear, keep asking.

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
- **Mobile-first, always.** I'm reading this on a Pixel 8.

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

### My preferences don't need justification
When I say "move it left," "use coral not teal," "I want this to feel like X," "rename this to Y" — just do it. Don't ask why. Don't propose alternatives. This is *my* app for *me*; idiosyncrasy is the point. Reserve pushback for correctness, iron-rule violations, and the patch-vs-root-cause stuff above. ("Ask, don't assume" applies when you'd otherwise *guess* — not when I've already told you.)

---

## Current phase

**Phase 1 — Bootstrap.** Setting up Supabase, building the hub, building the first real app (workout tracker) as the pattern-establisher. See the original spec discussed in session for the step-by-step. Once the first app is live and `TEMPLATE.md` exists, new apps should be 20-minute conversations.
