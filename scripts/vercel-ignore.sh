#!/usr/bin/env bash
# Path-based Ignored Build Step for the Personal-Hub monorepo.
#
# Vercel semantics:
#   exit 0  → skip this project's build (no relevant changes)
#   exit 1  → proceed with build
#
# Usage (vercel.json ignoreCommand):
#   bash $(git rev-parse --show-toplevel)/scripts/vercel-ignore.sh event-radar

set -euo pipefail

APP="${1:-}"
if [[ -z "$APP" ]]; then
  echo "usage: vercel-ignore.sh <app-folder-under-apps/>" >&2
  exit 1
fi

# Always run from monorepo root (Vercel Root Directory may be apps/<name>)
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" || ! -d "$ROOT" ]]; then
  echo "vercel-ignore: cannot resolve repo root — building $APP"
  exit 1
fi
cd "$ROOT"

# Prefer Vercel's previous deployment SHA when present; else HEAD^
PREV="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [[ -z "$PREV" ]] || ! git cat-file -e "${PREV}^{commit}" 2>/dev/null; then
  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    PREV="HEAD^"
  else
    echo "vercel-ignore: no previous SHA — building $APP"
    exit 1
  fi
fi

PATHS=(
  "apps/${APP}"
  "package.json"
  "package-lock.json"
  "turbo.json"
  "scripts/vercel-ignore.sh"
)

echo "vercel-ignore: comparing ${PREV}..HEAD for ${PATHS[*]}"
git --no-pager diff --name-only "${PREV}" HEAD -- "${PATHS[@]}" || true

if git diff --quiet "${PREV}" HEAD -- "${PATHS[@]}"; then
  echo "vercel-ignore: no changes under apps/${APP} (or shared root) — skipping"
  exit 0
fi

echo "vercel-ignore: changes detected for $APP — building"
exit 1
