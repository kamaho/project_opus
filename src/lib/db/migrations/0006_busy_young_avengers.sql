CREATE TABLE "sync_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"source" text NOT NULL,
	"cursor_type" text NOT NULL,
	"cursor_value" text NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_cursors_lookup" ON "sync_cursors" USING btree ("tenant_id","source","cursor_type");--> statement-breakpoint
CREATE INDEX "idx_sync_cursors_source" ON "sync_cursors" USING btree ("source","updated_at");