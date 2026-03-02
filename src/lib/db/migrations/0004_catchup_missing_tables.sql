-- Catch-up migration: create 15 tables that were applied manually
-- and not tracked in the Drizzle journal.
-- All statements use IF NOT EXISTS — idempotent and safe to run anywhere.

-- ============================================================
-- CREATE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"all_day" boolean DEFAULT false,
	"color" text,
	"created_by" text NOT NULL,
	"attendees" text[] DEFAULT '{}'::text[],
	"reminder_minutes_before" integer,
	"recurrence" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "client_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"client_id" uuid NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "client_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"assigned_user_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"company" text,
	"phone" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "control_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"client_id" uuid,
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
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dashboard_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"dashboard_type" text NOT NULL,
	"layout" text DEFAULT 'overview' NOT NULL,
	"hidden_modules" text[] DEFAULT '{}'::text[],
	"module_settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_request_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"content_type" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"token" text NOT NULL,
	"task_id" uuid,
	"client_id" uuid,
	"transaction_id" uuid,
	"contact_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "document_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"company_id" uuid,
	"client_id" uuid,
	"type" text DEFAULT 'manual' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text,
	"assignee_id" text,
	"external_contact_id" uuid,
	"notify_external" boolean DEFAULT false,
	"created_by" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"resolution" text,
	"linked_deadline_id" uuid,
	"linked_event_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tripletex_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"consumer_token" text NOT NULL,
	"employee_token" text NOT NULL,
	"base_url" text DEFAULT 'https://tripletex.no/v2' NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tripletex_sync_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"tripletex_company_id" integer NOT NULL,
	"set1_tripletex_account_id" integer,
	"set2_tripletex_account_id" integer,
	"set1_tripletex_account_ids" jsonb DEFAULT '[]'::jsonb,
	"set2_tripletex_account_ids" jsonb DEFAULT '[]'::jsonb,
	"enabled_fields" jsonb DEFAULT '{"description":true,"bilag":true,"faktura":false,"reference":true,"foreignAmount":false,"accountNumber":true}'::jsonb,
	"date_from" date NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_posting_id" integer,
	"last_sync_bank_tx_id" integer,
	"sync_interval_minutes" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tutorial_audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutorial_id" uuid NOT NULL,
	"org_role" text,
	"org_id" text
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tutorial_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutorial_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tutorial_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutorial_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"element_selector" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"pathname" text,
	"tooltip_position" text DEFAULT 'bottom' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tutorials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"pathname_pattern" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"visibility" text DEFAULT 'all' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================

ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_group_id_client_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."client_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "control_results" ADD CONSTRAINT "control_results_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "control_results" ADD CONSTRAINT "control_results_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "document_request_files" ADD CONSTRAINT "document_request_files_request_id_document_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_external_contact_id_contacts_id_fk" FOREIGN KEY ("external_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linked_deadline_id_regulatory_deadlines_id_fk" FOREIGN KEY ("linked_deadline_id") REFERENCES "public"."regulatory_deadlines"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_linked_event_id_calendar_events_id_fk" FOREIGN KEY ("linked_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tripletex_sync_configs" ADD CONSTRAINT "tripletex_sync_configs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tutorial_audiences" ADD CONSTRAINT "tutorial_audiences_tutorial_id_tutorials_id_fk" FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tutorial_completions" ADD CONSTRAINT "tutorial_completions_tutorial_id_tutorials_id_fk" FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "tutorial_steps" ADD CONSTRAINT "tutorial_steps_tutorial_id_tutorials_id_fk" FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "idx_cal_events_tenant" ON "calendar_events" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_cal_events_range" ON "calendar_events" USING btree ("tenant_id","start_at","end_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_client_group_members_group" ON "client_group_members" USING btree ("group_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_client_group_members_client" ON "client_group_members" USING btree ("client_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_client_groups_tenant" ON "client_groups" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_contacts_tenant" ON "contacts" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_control_results_tenant" ON "control_results" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_control_results_company" ON "control_results" USING btree ("company_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_control_results_type" ON "control_results" USING btree ("control_type");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_control_results_type_period" ON "control_results" USING btree ("control_type","period_year","period_month");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_dashboard_configs_unique" ON "dashboard_configs" USING btree ("tenant_id","user_id","dashboard_type");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_dashboard_configs_tenant" ON "dashboard_configs" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_document_request_files_request" ON "document_request_files" USING btree ("request_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_document_requests_token" ON "document_requests" USING btree ("token");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_document_requests_tenant" ON "document_requests" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_document_requests_contact" ON "document_requests" USING btree ("contact_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_document_requests_task" ON "document_requests" USING btree ("task_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_document_requests_status" ON "document_requests" USING btree ("status","expires_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_tenant" ON "tasks" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_assignee" ON "tasks" USING btree ("tenant_id","assignee_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" USING btree ("tenant_id","status","due_date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_client" ON "tasks" USING btree ("client_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_company" ON "tasks" USING btree ("company_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks" USING btree ("tenant_id","due_date");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_linked_deadline" ON "tasks" USING btree ("tenant_id","linked_deadline_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tasks_linked_event" ON "tasks" USING btree ("tenant_id","linked_event_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tripletex_conn_tenant" ON "tripletex_connections" USING btree ("tenant_id");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tripletex_sync_client" ON "tripletex_sync_configs" USING btree ("client_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tripletex_sync_active" ON "tripletex_sync_configs" USING btree ("is_active","last_sync_at");
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tutorial_completions_unique" ON "tutorial_completions" USING btree ("tutorial_id","user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tutorial_steps_tutorial" ON "tutorial_steps" USING btree ("tutorial_id","step_order");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_tutorials_pathname" ON "tutorials" USING btree ("pathname_pattern");
--> statement-breakpoint
