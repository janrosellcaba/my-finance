ALTER TABLE `category` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `category` ADD `is_default` integer DEFAULT false NOT NULL;