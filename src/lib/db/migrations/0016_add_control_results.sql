CREATE TABLE "control_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" text NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
  "control_type" text NOT NULL,
  "period_year" integer,
  "period_month" integer,
  "period_quarter" integer,
  "as_of_date" timestamp with time zone,
  "overall_status" text NOT NULL,
  "summary" jsonb NOT NULL,
  "deviations" jsonb NOT NULL,
  "source_system" text NOT NULL,
  "report_pdf_url" text,
  "report_excel_url" text,
  "executed_at" timestamp with time zone DEFAULT now(),
  "executed_by" text NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX "idx_control_results_tenant" ON "control_results" ("tenant_id");
CREATE INDEX "idx_control_results_company" ON "control_results" ("company_id");
CREATE INDEX "idx_control_results_type" ON "control_results" ("control_type");
CREATE INDEX "idx_control_results_type_period" ON "control_results" ("control_type", "period_year", "period_month");
