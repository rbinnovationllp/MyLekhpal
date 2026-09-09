-- MyLekhapal design-document foundation. No OAuth tokens or provider API keys are stored in D1.
CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `phone` text,
  `auth_provider` text NOT NULL,
  `mfa_enabled` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `clients` (
  `id` text PRIMARY KEY NOT NULL,
  `ca_business_id` text NOT NULL,
  `client_business_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` text NOT NULL,
  FOREIGN KEY (`ca_business_id`) REFERENCES `businesses`(`id`),
  FOREIGN KEY (`client_business_id`) REFERENCES `businesses`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_ca_client_unique` ON `clients` (`ca_business_id`,`client_business_id`);
--> statement-breakpoint
CREATE TABLE `approval_matrix` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `role` text NOT NULL,
  `approval_threshold` integer NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
);
--> statement-breakpoint
CREATE INDEX `approval_matrix_business` ON `approval_matrix` (`business_id`,`role`);
--> statement-breakpoint
CREATE TABLE `source_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `entry_id` text,
  `doc_type` text NOT NULL,
  `storage_provider` text NOT NULL,
  `google_file_id` text,
  `file_name` text NOT NULL,
  `file_hash` text NOT NULL,
  `extracted_fields` text,
  `ocr_confidence` text,
  `verification_status` text NOT NULL DEFAULT 'unverified',
  `uploaded_by` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`),
  FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`)
);
--> statement-breakpoint
CREATE INDEX `source_documents_business` ON `source_documents` (`business_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_documents_business_hash` ON `source_documents` (`business_id`,`file_hash`);
--> statement-breakpoint
CREATE TABLE `exceptions` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `entry_id` text NOT NULL,
  `exception_type` text NOT NULL,
  `risk_level` text NOT NULL,
  `required_action` text NOT NULL,
  `assigned_reviewer_id` text,
  `resolution_status` text NOT NULL DEFAULT 'open',
  `resolution_notes` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`),
  FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`)
);
--> statement-breakpoint
CREATE INDEX `exceptions_business_open` ON `exceptions` (`business_id`,`resolution_status`);
--> statement-breakpoint
CREATE TABLE `mapping_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `name` text NOT NULL,
  `column_mapping` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `source_file_hash` text NOT NULL,
  `uploaded_by` text NOT NULL,
  `row_count` integer NOT NULL DEFAULT 0,
  `rows_created` integer NOT NULL DEFAULT 0,
  `rows_duplicate` integer NOT NULL DEFAULT 0,
  `rows_failed` integer NOT NULL DEFAULT 0,
  `rows_pending` integer NOT NULL DEFAULT 0,
  `rows_excluded` integer NOT NULL DEFAULT 0,
  `mapping_profile_id` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`),
  FOREIGN KEY (`mapping_profile_id`) REFERENCES `mapping_profiles`(`id`)
);
--> statement-breakpoint
CREATE INDEX `import_batches_business` ON `import_batches` (`business_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `gst_periods` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `gstin` text NOT NULL,
  `period` text NOT NULL,
  `output_tax_liability` integer,
  `reverse_charge_liability` integer,
  `eligible_itc` integer,
  `estimated_net_payable` integer,
  `gstr1_status` text,
  `gstr3b_status` text,
  `challan_status` text,
  `ca_review_status` text,
  `computed_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gst_periods_business_period` ON `gst_periods` (`business_id`,`gstin`,`period`);
--> statement-breakpoint
CREATE TABLE `google_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `connected_by_user_id` text NOT NULL,
  `google_account_email` text NOT NULL,
  `scope_granted` text NOT NULL,
  `connected_at` text NOT NULL,
  `last_sync_at` text,
  `sync_status` text NOT NULL DEFAULT 'not_connected',
  `revoked_at` text,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
);
--> statement-breakpoint
CREATE INDEX `google_connections_business` ON `google_connections` (`business_id`,`revoked_at`);
--> statement-breakpoint
CREATE TABLE `google_synced_items` (
  `id` text PRIMARY KEY NOT NULL,
  `connection_id` text NOT NULL,
  `google_file_id` text NOT NULL,
  `google_file_type` text NOT NULL,
  `purpose` text NOT NULL,
  `last_synced_at` text,
  `sync_status` text NOT NULL,
  `last_error` text,
  FOREIGN KEY (`connection_id`) REFERENCES `google_connections`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_synced_items_connection_file` ON `google_synced_items` (`connection_id`,`google_file_id`);
--> statement-breakpoint
CREATE TABLE `usage_records` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `user_id` text,
  `event_type` text NOT NULL,
  `quantity` integer NOT NULL,
  `estimated_cost` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL,
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
);
--> statement-breakpoint
CREATE INDEX `usage_records_business_created` ON `usage_records` (`business_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `audit_append_only_update`
BEFORE UPDATE ON `audit`
BEGIN
  SELECT RAISE(ABORT, 'audit records are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_append_only_delete`
BEFORE DELETE ON `audit`
BEGIN
  SELECT RAISE(ABORT, 'audit records are append-only');
END;
