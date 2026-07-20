# Vercel: only rebuild the app that changed

Hobby plan allows **100 deployments / day** account-wide. This monorepo has
multiple Vercel projects on the same GitHub repo, so a push can burn one deploy
per project unless each project skips when its files are unchanged.

## Configured in-repo (preferred)

Each app has `ignoreCommand` in its `vercel.json`:

```json
"ignoreCommand": "bash $(git rev-parse --show-toplevel)/scripts/vercel-ignore.sh <app-folder>"
```

Script: `scripts/vercel-ignore.sh`

- Change only `apps/event-radar/**` → only event-radar builds
- Change `package.json` / lockfile / `turbo.json` → all apps rebuild

No dashboard “Ignored Build Step” needed unless you want to override.

## Optional dashboard override

**Project → Settings → Build and Deployment** (not the Git webhooks page):

Look for **Ignored Build Step** under build settings. Same command as above.

The screen with “Connected Git Repository / Pull Request Comments” is **not** the place.

## Rate limit

If checks say **Deployment rate limited — retry in 24 hours**, wait for the rolling
window. After that, ignoreCommand keeps you under the limit.
