-- SQLite only allows a constant default on ADD COLUMN (not strftime()).
-- New rows get created_at from the app; this backfills existing ones.
ALTER TABLE "transaction" ADD COLUMN created_at text NOT NULL DEFAULT '';
UPDATE "transaction" SET created_at = date || 'T00:00:00.' || printf('%06d', rowid) || 'Z';
CREATE INDEX IF NOT EXISTS idx_transaction_user_date_created ON "transaction" (user_id, date, created_at);
