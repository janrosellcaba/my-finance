ALTER TABLE `transaction` ADD `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL;--> statement-breakpoint
-- Give existing same-day rows a stable order (by rowid) so balances/list order stay deterministic.
UPDATE `transaction` SET `created_at` = `date` || 'T00:00:00.' || printf('%06d', `rowid`) || 'Z';--> statement-breakpoint
CREATE INDEX `idx_transaction_user_date_created` ON `transaction` (`user_id`,`date`,`created_at`);
