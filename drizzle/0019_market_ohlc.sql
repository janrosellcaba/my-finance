ALTER TABLE `market_price` ADD `open` real;--> statement-breakpoint
ALTER TABLE `market_price` ADD `high` real;--> statement-breakpoint
ALTER TABLE `market_price` ADD `low` real;--> statement-breakpoint
-- Cached prices predate OHLC: expire them so the next visit refetches and fills the candles.
UPDATE `market_sync` SET `attempted_at` = 0;
