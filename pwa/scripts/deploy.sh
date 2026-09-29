#!/usr/bin/env bash
# Builds the production PWA and syncs it to the nginx web root for
# permadesignkit.org (served from /var/www because /root isn't traversable
# by the www-data user nginx runs as).
#
# Only deploys a clean `main` that matches origin/main, so what's live is
# always a commit anyone can check out — not a feature branch, a worktree,
# or uncommitted edits. DEPLOY_FORCE=1 skips these checks (emergencies only).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "${DEPLOY_FORCE:-}" != "1" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" != "main" ]]; then
    echo "Refusing to deploy: on branch '$branch', not 'main'." >&2
    exit 1
  fi
  if [[ -n "$(git status --porcelain -- .)" ]]; then
    echo "Refusing to deploy: uncommitted changes in pwa/:" >&2
    git status --short -- . >&2
    exit 1
  fi
  git fetch --quiet origin main
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
    echo "Refusing to deploy: local main ($(git rev-parse --short HEAD)) differs from origin/main ($(git rev-parse --short origin/main)). Pull or push first." >&2
    exit 1
  fi
fi

# Incremental install (not `npm ci`): keeps a dev server running from this
# checkout alive while still picking up dependency changes from the lockfile.
npm install --no-audit --no-fund --silent
npm test
npm run build

rsync -a --delete dist/ /var/www/permadesignkit.org/
chown -R www-data:www-data /var/www/permadesignkit.org

echo "Deployed $(git rev-parse --short HEAD) to https://permadesignkit.org"
