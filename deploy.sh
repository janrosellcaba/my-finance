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
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=384}"
npm ci

echo "==> 💾 Backing up database before migration..."
set -a
source .env
set +a
mkdir -p /home/jan/my-finance/backups
# `.backup` goes through SQLite's own consistent-snapshot machinery -- safe to run
# against a live WAL-mode database. A plain `cp` here would risk capturing a torn
# snapshot (recent commits can still be sitting in the -wal file, not yet in the
# main .db file), which is exactly the kind of silent corruption we can't afford.
sqlite3 "$DATABASE_URL" ".backup '/home/jan/my-finance/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).db'"

echo "==> 🗄️ Applying database migrations..."
# Replays the reviewed, committed SQL files in drizzle/ — never use `drizzle-kit push` here.
# push diffs live schema at runtime and can decide a change is "unsafe" even when schema.ts
# has a default, offering to truncate the table instead. migrate just runs the exact SQL.
if ! npx drizzle-kit migrate; then
    echo "⚠️ drizzle-kit migrate failed; will still try to add transaction.created_at if missing"
fi

# drizzle-kit can exit without applying migrations (that's what broke /api/dashboard
# for created_at, and the homepage for appearance columns). Apply missing columns directly.
created_at_cols="$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM pragma_table_info('transaction') WHERE name='created_at';")"
if [ "$created_at_cols" = "0" ]; then
    echo "==> Adding missing transaction.created_at..."
    sqlite3 "$DATABASE_URL" < /home/jan/my-finance/scripts/ensure-created-at.sql
fi
created_at_cols="$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM pragma_table_info('transaction') WHERE name='created_at';")"
if [ "$created_at_cols" = "0" ]; then
    echo "❌ transaction.created_at is still missing"
    exit 1
fi

accent_cols="$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='accent_color';")"
if [ "$accent_cols" = "0" ]; then
    echo "==> Adding missing users appearance columns..."
    # Apply one ALTER at a time — SQLite errors if a column already exists mid-script.
    for col_sql in \
        "ALTER TABLE users ADD COLUMN accent_color text NOT NULL DEFAULT 'green';" \
        "ALTER TABLE users ADD COLUMN currency text NOT NULL DEFAULT 'EUR';" \
        "ALTER TABLE users ADD COLUMN date_format text NOT NULL DEFAULT 'DMY';"
    do
        sqlite3 "$DATABASE_URL" "$col_sql" 2>/dev/null || true
    done
fi
accent_cols="$(sqlite3 "$DATABASE_URL" "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='accent_color';")"
if [ "$accent_cols" = "0" ]; then
    echo "❌ users.accent_color is still missing"
    exit 1
fi

echo "==> 🏗️ Building Next.js application..."
npm run build

echo "==> 🧠 Capping Node heap for the running service..."
sudo mkdir -p /etc/systemd/system/my-finance.service.d
sudo tee /etc/systemd/system/my-finance.service.d/memory.conf >/dev/null <<'EOF'
[Service]
Environment=NODE_OPTIONS=--max-old-space-size=256
Environment=NEXT_TELEMETRY_DISABLED=1
EOF
sudo systemctl daemon-reload

echo "==> 🔄 Restarting systemd service..."
sudo systemctl restart my-finance

echo "==> ✅ Done! Verifying status..."
sudo systemctl status my-finance --no-pager
