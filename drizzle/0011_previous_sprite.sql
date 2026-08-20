CREATE INDEX `idx_session_expires` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_transaction_user_account` ON `transaction` (`user_id`,`account_id`);