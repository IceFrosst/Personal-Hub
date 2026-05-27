# `scripts/`

Bootstrap automation for the personal-apps portfolio. These scripts are run from cloud sessions, not from the deployed app.

## `setup-vercel-project.mjs`

Creates a Vercel project for a new app: links it to its GitHub repo, sets production branch to `stable`, pastes the standard Supabase env vars.

### Prereqs

- The GitHub repo `IceFrosst/<repo>` must already exist.
- The Vercel GitHub App must have access to it (the easiest way: grant "All repositories" once at https://github.com/settings/installations).
- These env vars must be set in the session:
  - `VERCEL_TOKEN` — generated at https://vercel.com/account/tokens
  - `VERCEL_TEAM_ID` — find at https://vercel.com/account ("Your ID")

Both are personal secrets — paste them into the Claude Code cloud env vars panel; they'll be available in every future session.

### Run it

```bash
npm run setup-vercel -- --repo workout --name icefrosst-workout
```

Optional flags:
- `--prod-branch <name>` — production branch (default: `stable`)
- `--github-owner <name>` — GitHub owner (default: `IceFrosst`)

### Output

Three URLs once Vercel finishes the first build:
- Production (`stable` branch) → `icefrosst-<slug>.vercel.app`
- Preview (`main` branch) → `icefrosst-<slug>-git-main-<team-slug>.vercel.app`
- Preview (`previous` branch) → `icefrosst-<slug>-git-previous-<team-slug>.vercel.app`

Confirm the exact preview URLs in the Vercel dashboard after the first deploy (Vercel sometimes truncates long names; the `<team-slug>` segment also depends on your team's slug).

### Surrounding steps (Claude does these in-session, no separate script needed)

1. Create the three branches on GitHub (`stable`, `previous`, `main`) — Vercel won't deploy preview branches until they exist.
2. Add an entry to `hub/config/apps.json` with the three URLs.
3. Push to `main` of the hub repo so the new tile shows up.

These happen in-session via Claude's tools (git, GitHub MCP, Edit). Describing what you want in plain English — "let's build a workout app" — triggers the whole sequence because CLAUDE.md documents the discovery and execution flow. This script is the deterministic Vercel piece Claude reaches for.
