CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"title" text NOT NULL,
	"format" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"summary" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"period_year" integer,
	"period_month" integer,
	"as_of_date" timestamp with time zone,
	"source_system" text NOT NULL,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_tenant" ON "reports" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_company" ON "reports" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_type" ON "reports" USING btree ("report_type");
