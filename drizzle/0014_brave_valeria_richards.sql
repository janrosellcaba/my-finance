ALTER TABLE `todo` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `todo` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_todo_user_parent_sort` ON `todo` (`user_id`,`parent_id`,`sort_order`);
