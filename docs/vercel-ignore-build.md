# Vercel: only rebuild the app that changed

Hobby plan allows **100 deployments / day** account-wide. This monorepo has
multiple Vercel projects on the same GitHub repo, so a push can burn one deploy
per project unless each project skips when its files are unchanged.

## One-time setup (dashboard, ~1 min per project)

For **each** Vercel project linked to `Personal-Hub`:

1. Open **Project → Settings → Git**
2. **Ignored Build Step** → set exactly (match the app folder):

| Vercel project | Ignored Build Step command |
|----------------|----------------------------|
| `icefrosst-event-radar` | `bash scripts/vercel-ignore.sh event-radar` |
| `icefrosst-hub` | `bash scripts/vercel-ignore.sh hub` |
| `icefrosst-lock-in` (or similar) | `bash scripts/vercel-ignore.sh lock-in` |
| `icefrosst-focus-gate-personal-app` | `bash scripts/vercel-ignore.sh focus-gate` |
| `icefrosst-cookie-jar` | `bash scripts/vercel-ignore.sh cookie-jar` |

3. Save. Root Directory stays `apps/<name>` as already configured.

## Behaviour

- Change only `apps/event-radar/**` → only event-radar builds; others skip.
- Change `package.json` / lockfile / `turbo.json` → all apps rebuild (shared deps).
- Script lives at `scripts/vercel-ignore.sh`.

## Why not only `npx turbo-ignore`?

`turbo-ignore` is deprecated in favour of Vercel’s built-in monorepo skipping and
can still rebuild more often than needed. Path-based ignore is predictable and
works even when Turbo’s graph is noisy.

## Rate limit today

If GitHub checks say **Deployment rate limited — retry in 24 hours**, the daily
quota is exhausted. Wait for the rolling window, then the ignore step keeps you
under the limit going forward.
