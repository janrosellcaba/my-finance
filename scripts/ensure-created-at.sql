-- Idempotent enough for a one-shot sqlite3 run. If created_at already exists,
-- ALTER fails and you can ignore it. Index uses IF NOT EXISTS.
ALTER TABLE "transaction" ADD COLUMN created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;
UPDATE "transaction" SET created_at = date || 'T00:00:00.' || printf('%06d', rowid) || 'Z';
CREATE INDEX IF NOT EXISTS idx_transaction_user_date_created ON "transaction" (user_id, date, created_at);
