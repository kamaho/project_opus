CREATE TABLE "account_sync_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"tripletex_account_id" bigint NOT NULL,
	"account_type" text DEFAULT 'ledger' NOT NULL,
	"sync_level" text DEFAULT 'balance_only' NOT NULL,
	"balance_in" numeric(18, 2),
	"balance_out" numeric(18, 2),
	"balance_year" integer,
	"client_id" uuid,
	"activated_at" timestamp with time zone,
	"activated_by" text,
	"last_balance_sync_at" timestamp with time zone,
	"last_tx_sync_at" timestamp with time zone,
	"tx_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ADD COLUMN "initial_sync_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ADD COLUMN "account_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ADD COLUMN "last_balance_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_sync_settings" ADD CONSTRAINT "account_sync_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_sync_settings" ADD CONSTRAINT "account_sync_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_account_sync_unique" ON "account_sync_settings" USING btree ("tenant_id","company_id","account_number");--> statement-breakpoint
CREATE INDEX "idx_account_sync_company" ON "account_sync_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_account_sync_active" ON "account_sync_settings" USING btree ("tenant_id","company_id","sync_level");