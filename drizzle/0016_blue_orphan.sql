ALTER TABLE `users` ADD `last_seen_at` text;
--> statement-breakpoint
UPDATE `users`
SET `last_seen_at` = (
  SELECT strftime('%Y-%m-%dT%H:%M:%fZ', (MAX(`expires_at`) / 1000.0) - 2592000, 'unixepoch')
  FROM `session`
  WHERE `session`.`user_id` = `users`.`id`
)
WHERE `last_seen_at` IS NULL
  AND EXISTS (SELECT 1 FROM `session` WHERE `session`.`user_id` = `users`.`id`);