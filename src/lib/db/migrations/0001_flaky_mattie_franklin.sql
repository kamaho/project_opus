CREATE TABLE "agent_job_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" text NOT NULL,
	"match_count" integer,
	"transaction_count" integer,
	"report_sent" boolean DEFAULT false,
	"error_message" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_report_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"report_types" jsonb DEFAULT '["open_items"]'::jsonb NOT NULL,
	"smart_match_enabled" boolean DEFAULT true NOT NULL,
	"smart_match_schedule" text,
	"report_schedule" text,
	"specific_dates" jsonb DEFAULT '[]'::jsonb,
	"preferred_time" text DEFAULT '03:00',
	"next_match_run" timestamp with time zone,
	"next_report_run" timestamp with time zone,
	"last_match_run" timestamp with time zone,
	"last_report_run" timestamp with time zone,
	"last_match_count" integer,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb,
	"mode" text DEFAULT 'support',
	"page_context" text,
	"tools_used" text[] DEFAULT '{}',
	"tokens_used" integer DEFAULT 0,
	"rating" integer,
	"feedback" text,
	"resolved" boolean,
	"escalated" boolean DEFAULT false,
	"duration_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_user_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"memory_type" text NOT NULL,
	"content" text NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.80',
	"last_relevant_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" text NOT NULL,
	"summary" text,
	"keywords" text[] DEFAULT '{}',
	"applies_to" text[] DEFAULT '{}',
	"valid_from" date,
	"valid_to" date,
	"source" text,
	"source_url" text,
	"confidence" numeric(3, 2) DEFAULT '1.00',
	"version" integer DEFAULT 1,
	"status" text DEFAULT 'published',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "knowledge_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "knowledge_faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"question_variants" text[] DEFAULT '{}',
	"answer" text NOT NULL,
	"answer_action" text,
	"category" text,
	"feature" text,
	"priority" integer DEFAULT 0,
	"times_matched" integer DEFAULT 0,
	"status" text DEFAULT 'published',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"fact" text NOT NULL,
	"context" text,
	"trigger_phrases" text[] DEFAULT '{}',
	"priority" integer DEFAULT 0,
	"always_include" boolean DEFAULT false,
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"from_user_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read" boolean DEFAULT false,
	"entity_type" text,
	"entity_id" text,
	"group_key" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"prerequisites" text[] DEFAULT '{}',
	"steps" jsonb DEFAULT '[]'::jsonb,
	"difficulty" text DEFAULT 'beginner',
	"estimated_time_minutes" integer,
	"roles" text[] DEFAULT '{}',
	"keywords" text[] DEFAULT '{}',
	"status" text DEFAULT 'published',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_guides_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "regulatory_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"obligation" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"frequency" text NOT NULL,
	"period_start_month" integer,
	"period_end_month" integer,
	"deadline_rule" jsonb NOT NULL,
	"exceptions" jsonb DEFAULT '[]'::jsonb,
	"applies_to_entity" text[] DEFAULT '{}',
	"applies_to_role" text[] DEFAULT '{}',
	"legal_reference" text,
	"legal_url" text,
	"valid_from" date,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"content_type" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"profile_completed" boolean DEFAULT false,
	"first_client_created" boolean DEFAULT false,
	"bank_connected" boolean DEFAULT false,
	"first_match_run" boolean DEFAULT false,
	"team_invited" boolean DEFAULT false,
	"notifications_configured" boolean DEFAULT false,
	"revizo_enabled" boolean DEFAULT false,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "companies" DROP CONSTRAINT "companies_parent_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "type" text DEFAULT 'company' NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "file_hash" text;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "dim8" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "dim9" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "dim10" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "date2" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "buntref" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "notat" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "bilag" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "faktura" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "forfall" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "periode" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "import_number" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "avgift" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "tilleggstekst" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ref2" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ref3" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ref4" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ref5" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "ref6" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "anleggsnr" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "anleggsbeskrivelse" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "bilagsart" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "avsnr" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "tid" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "avvikende_dato" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "rate" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "kundenavn" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "kontonummer_bokforing" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "notat_author" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "mentioned_user_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "notat_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "opening_balance_delta" numeric(18, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "agent_job_logs" ADD CONSTRAINT "agent_job_logs_config_id_agent_report_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."agent_report_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_report_configs" ADD CONSTRAINT "agent_report_configs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_snippets" ADD CONSTRAINT "knowledge_snippets_article_id_knowledge_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_logs_config" ON "agent_job_logs" USING btree ("config_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_logs_client" ON "agent_job_logs" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_config_client" ON "agent_report_configs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agent_config_tenant" ON "agent_report_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_agent_config_next_match" ON "agent_report_configs" USING btree ("enabled","next_match_run");--> statement-breakpoint
CREATE INDEX "idx_agent_config_next_report" ON "agent_report_configs" USING btree ("enabled","next_report_run");--> statement-breakpoint
CREATE INDEX "idx_ai_conv_user_org" ON "ai_conversations" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_ai_conv_created" ON "ai_conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_memory_user_org" ON "ai_user_memory" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_tenant" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_tenant" ON "notifications" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_attachments_transaction" ON "transaction_attachments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_client" ON "transaction_attachments" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_onboarding_user" ON "user_onboarding" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_imports_client_set" ON "imports" USING btree ("client_id","set_number");--> statement-breakpoint
CREATE INDEX "idx_imports_client_deleted" ON "imports" USING btree ("client_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_imports_file_hash" ON "imports" USING btree ("client_id","set_number","file_hash");--> statement-breakpoint
CREATE INDEX "idx_transactions_amount_date" ON "transactions" USING btree ("client_id","amount","date1");--> statement-breakpoint
CREATE INDEX "idx_transactions_created" ON "transactions" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_transactions_dedup" ON "transactions" USING btree ("client_id","set_number","amount","date1","reference");--> statement-breakpoint
CREATE INDEX "idx_transactions_import_id" ON "transactions" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_match_id" ON "transactions" USING btree ("match_id");