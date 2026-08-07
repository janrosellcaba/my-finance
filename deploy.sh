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

echo "==> 📦 Installing dependencies..."
npm ci

echo "==> 🗄️ Updating SQLite database schema..."
# Pushes any Drizzle schema changes directly to data/sqlite.db
npx drizzle-kit push

echo "==> 🏗️ Building Next.js application..."
npm run build

echo "==> 🔄 Restarting systemd service..."
sudo systemctl restart my-finance

echo "==> ✅ Done! Verifying status..."
sudo systemctl status my-finance --no-pager
