CREATE TABLE `market_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_market_asset_user_symbol` ON `market_asset` (`user_id`,`symbol`);--> statement-breakpoint
CREATE INDEX `idx_market_asset_user_sort` ON `market_asset` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `market_price` (
	`symbol` text NOT NULL,
	`date` text NOT NULL,
	`close` real NOT NULL,
	PRIMARY KEY(`symbol`, `date`)
);
--> statement-breakpoint
CREATE TABLE `market_seed` (
	`user_id` text PRIMARY KEY NOT NULL,
	`seeded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `market_sync` (
	`symbol` text PRIMARY KEY NOT NULL,
	`currency` text,
	`price` real,
	`price_time` integer,
	`fetched_at` integer,
	`attempted_at` integer DEFAULT 0 NOT NULL,
	`ok` integer DEFAULT false NOT NULL
);
