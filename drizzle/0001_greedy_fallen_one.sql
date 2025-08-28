CREATE TABLE `app_configurations` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_app_configurations_updated_at` ON `app_configurations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text,
	`event_type` text NOT NULL,
	`details` text,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_events_project` ON `events` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_events_type` ON `events` (`event_type`);--> statement-breakpoint
CREATE INDEX `idx_events_timestamp` ON `events` (`timestamp`);--> statement-breakpoint
CREATE TABLE `executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`command` text NOT NULL,
	`working_dir` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`exit_code` integer,
	`stdout` text,
	`stderr` text,
	`status` text NOT NULL,
	`attempt_number` integer DEFAULT 1,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_executions_project` ON `executions` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_executions_status` ON `executions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_executions_started_at` ON `executions` (`started_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`name` text,
	`config` text NOT NULL,
	`discovered_at` integer NOT NULL,
	`destroy_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE INDEX `idx_projects_status` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_destroy_at` ON `projects` (`destroy_at`);--> statement-breakpoint
CREATE INDEX `idx_projects_path` ON `projects` (`path`);