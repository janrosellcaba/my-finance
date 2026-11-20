#!/usr/bin/env bash
# One-off repair for production: `drizzle-kit migrate` had silently stopped at migration 0011
# because 0012-0016 add columns that deploy.sh had already added by hand ("duplicate column").
# This records 0012-0016 in __drizzle_migrations as applied -- but ONLY after verifying that
# their effects really exist in the database. It never alters data or schema itself.
#
# Usage (on ion):  DATABASE_URL=/abs/path/to.db ./scripts/repair-migration-ledger.sh
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL must be set to the absolute path of the SQLite file}"
cd "$(dirname "$0")/.."

has_col() { [ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM pragma_table_info('$1') WHERE name='$2';")" != "0" ]; }
has_idx() { [ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='$1';")" != "0" ]; }

fail=0
check() { # description, command...
    local desc="$1"; shift
    if "$@"; then echo "  ok      $desc"; else echo "  MISSING $desc"; fail=1; fi
}

echo "==> Verifying that migrations 0012-0016 are already reflected in the schema..."
check "0012 transaction.created_at"                 has_col transaction created_at
check "0012 idx_transaction_user_date_created"      has_idx idx_transaction_user_date_created
check "0013 users.accent_color"                     has_col users accent_color
check "0013 users.currency"                         has_col users currency
check "0013 users.date_format"                      has_col users date_format
check "0014 todo.parent_id"                         has_col todo parent_id
check "0014 todo.sort_order"                        has_col todo sort_order
check "0014 idx_todo_user_parent_sort"              has_idx idx_todo_user_parent_sort
check "0015 users.language"                         has_col users language
check "0016 users.last_seen_at"                     has_col users last_seen_at

if [ "$fail" != "0" ]; then
    echo "❌ Something is missing, so nothing was changed. Send the output above before continuing."
    exit 1
fi

# folderMillis values come straight from drizzle/meta/_journal.json; the hash is what drizzle
# itself computes (sha256 of the .sql file).
sql="BEGIN;"
while read -r tag when; do
    hash="$(sha256sum "drizzle/${tag}.sql" | cut -d' ' -f1)"
    sql+="INSERT INTO __drizzle_migrations (hash, created_at) SELECT '${hash}', ${when} WHERE NOT EXISTS (SELECT 1 FROM __drizzle_migrations WHERE hash='${hash}');"
done < <(python3 - <<'PY'
import json
for e in json.load(open("drizzle/meta/_journal.json"))["entries"]:
    if 12 <= e["idx"] <= 16:
        print(e["tag"], e["when"])
PY
)
sql+="COMMIT;"

sqlite3 "$DB" "$sql"
echo "==> Ledger now ends with:"
sqlite3 "$DB" "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 6;"
echo "✅ Done. Now run: npx drizzle-kit migrate"
