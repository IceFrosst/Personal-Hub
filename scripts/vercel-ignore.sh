#!/usr/bin/env bash
# Path-based Ignored Build Step for the Personal-Hub monorepo.
#
# Vercel semantics:
#   exit 0  → skip this project's build (no relevant changes)
#   exit 1  → proceed with build
#
# Usage (set as Project Settings → Git → Ignored Build Step):
#   bash scripts/vercel-ignore.sh event-radar
#   bash scripts/vercel-ignore.sh hub
#   bash scripts/vercel-ignore.sh lock-in
#   bash scripts/vercel-ignore.sh focus-gate
#   bash scripts/vercel-ignore.sh cookie-jar
#
# Always rebuilds if shared root tooling changes (package.json, lockfile,
# turbo.json, this script). Always builds on first commit of a branch
# (no HEAD^).

set -euo pipefail

APP="${1:-}"
if [[ -z "$APP" ]]; then
  echo "usage: vercel-ignore.sh <app-folder-under-apps/>" >&2
  exit 1
fi

# First commit on a branch / shallow clone edge cases → always build
if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "vercel-ignore: no HEAD^ — building $APP"
  exit 1
fi

PATHS=(
  "apps/${APP}"
  "package.json"
  "package-lock.json"
  "turbo.json"
  "scripts/vercel-ignore.sh"
)

if git diff --quiet HEAD^ HEAD -- "${PATHS[@]}"; then
  echo "vercel-ignore: no changes under apps/${APP} (or shared root) — skipping"
  exit 0
fi

echo "vercel-ignore: changes detected for $APP — building"
exit 1
