#!/usr/bin/env bash
set -euo pipefail

# 1. Hardcode the directory so it never runs in the wrong place
cd /home/jan/my-finance

# 2. Load NVM so the script knows exactly where npm and node are
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "==> Checking for uncommitted changes..."
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ Uncommitted local changes found, aborting:"
    git status --short
    exit 1
fi

echo "==> 📥 Pulling latest changes..."
git pull --ff-only

# Re-exec from a fresh read of this file. Bash keeps streaming a running script
# from the file handle it opened at start, so without this, a `git pull` that
# changes deploy.sh itself has no effect on the rest of THIS run -- everything
# below would silently execute the pre-pull version even though the pull
# succeeded and the file on disk is already updated.
if [ -z "${DEPLOY_REEXECED:-}" ]; then
    export DEPLOY_REEXECED=1
    exec "$0" "$@"
fi

echo "==> 📦 Installing dependencies..."
npm ci

echo "==> 💾 Backing up database before migration..."
set -a
source .env
set +a
mkdir -p /home/jan/my-finance/backups
cp "$DATABASE_URL" "/home/jan/my-finance/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).db"

echo "==> 🗄️ Applying database migrations..."
# Replays the reviewed, committed SQL files in drizzle/ — never use `drizzle-kit push` here.
# push diffs live schema at runtime and can decide a change is "unsafe" even when schema.ts
# has a default, offering to truncate the table instead. migrate just runs the exact SQL.
npx drizzle-kit migrate

echo "==> 🏗️ Building Next.js application..."
npm run build

echo "==> 🔄 Restarting systemd service..."
sudo systemctl restart my-finance

echo "==> ✅ Done! Verifying status..."
sudo systemctl status my-finance --no-pager
