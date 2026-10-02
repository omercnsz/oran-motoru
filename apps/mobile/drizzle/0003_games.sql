CREATE TABLE `game_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`game` text NOT NULL,
	`created_at` text NOT NULL,
	`ended_at` text,
	`bet` integer NOT NULL,
	`target` real,
	`outcome` real NOT NULL,
	`cashout` real,
	`payout` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_rounds_game_idx` ON `game_rounds` (`game`,`created_at`);--> statement-breakpoint
CREATE TABLE `token_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`round_id` text
);
--> statement-breakpoint
CREATE INDEX `token_events_round_idx` ON `token_events` (`round_id`);