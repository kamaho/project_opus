ALTER TABLE "tripletex_sync_configs" ADD COLUMN "sync_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ADD COLUMN "sync_error" text;