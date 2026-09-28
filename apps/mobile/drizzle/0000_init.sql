CREATE TABLE `cache` (
	`key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`stake` integer NOT NULL,
	`total_odds` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`payout` integer,
	`settled_at` text
);
--> statement-breakpoint
CREATE INDEX `coupons_status_idx` ON `coupons` (`status`);--> statement-breakpoint
CREATE INDEX `coupons_created_idx` ON `coupons` (`created_at`);--> statement-breakpoint
CREATE TABLE `savings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`coupon_id` text,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `selections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`coupon_id` text NOT NULL,
	`match_id` text NOT NULL,
	`league` text NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`date` text NOT NULL,
	`kickoff` text NOT NULL,
	`market_key` text NOT NULL,
	`outcome_key` text NOT NULL,
	`odds` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`final_home` integer,
	`final_away` integer,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `selections_coupon_idx` ON `selections` (`coupon_id`);