CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_business_code` ON `accounts` (`business_id`,`code`);--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`record_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_business` ON `audit` (`business_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`trade_name` text NOT NULL,
	`pan` text NOT NULL,
	`gstin` text NOT NULL,
	`year` integer NOT NULL,
	`state` text NOT NULL,
	`address` text NOT NULL,
	`status` text DEFAULT 'Onboarding draft' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `business_owner` ON `businesses` (`owner`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`date` text NOT NULL,
	`narration` text NOT NULL,
	`reference` text NOT NULL,
	`lines` text NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`source` text DEFAULT 'Manual' NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entry_business_date` ON `entries` (`business_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `entry_business_reference` ON `entries` (`business_id`,`reference`);