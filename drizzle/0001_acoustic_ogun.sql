CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_business_user_role` ON `memberships` (`business_id`,`user_id`,`role`);--> statement-breakpoint
CREATE INDEX `membership_user_status` ON `memberships` (`user_id`,`status`);--> statement-breakpoint
ALTER TABLE `businesses` ADD `client_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `businesses` ADD `entity_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `business_client_id` ON `businesses` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `business_client_id_unique` ON `businesses` (`client_id`) WHERE `client_id` <> '';
