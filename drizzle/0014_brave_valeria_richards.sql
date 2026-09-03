ALTER TABLE `todo` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `todo` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_todo_user_parent_sort` ON `todo` (`user_id`,`parent_id`,`sort_order`);--> statement-breakpoint
UPDATE `todo` SET `sort_order` = (
  SELECT COUNT(*) FROM `todo` AS `t2`
  WHERE `t2`.`user_id` = `todo`.`user_id`
    AND (
      `t2`.`created_at` > `todo`.`created_at`
      OR (`t2`.`created_at` = `todo`.`created_at` AND `t2`.`id` > `todo`.`id`)
    )
);
