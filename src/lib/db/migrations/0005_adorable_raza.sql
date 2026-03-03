CREATE TABLE "webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"process_after" timestamp with time zone DEFAULT now(),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"source" text NOT NULL,
	"external_sub_id" text,
	"webhook_url" text NOT NULL,
	"secret" text NOT NULL,
	"event_types" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhook_inbox_dedup" ON "webhook_inbox" USING btree ("tenant_id","source","external_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_inbox_pending" ON "webhook_inbox" USING btree ("status","process_after");--> statement-breakpoint
CREATE INDEX "idx_webhook_inbox_tenant" ON "webhook_inbox" USING btree ("tenant_id","source","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhook_sub_tenant_source" ON "webhook_subscriptions" USING btree ("tenant_id","source");