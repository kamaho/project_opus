CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"currency" text DEFAULT 'NOK',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"set1_account_id" uuid NOT NULL,
	"set2_account_id" uuid NOT NULL,
	"opening_balance_set1" numeric(18, 2) DEFAULT '0',
	"opening_balance_set2" numeric(18, 2) DEFAULT '0',
	"opening_balance_date" date,
	"allow_tolerance" boolean DEFAULT false,
	"tolerance_amount" numeric(18, 2) DEFAULT '0',
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"org_number" text,
	"parent_company_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"filename" text NOT NULL,
	"file_path" text NOT NULL,
	"parser_config_id" uuid,
	"record_count" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"error_message" text,
	"imported_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"rule_id" uuid,
	"match_type" text NOT NULL,
	"difference" numeric(18, 2) DEFAULT '0',
	"matched_at" timestamp with time zone DEFAULT now(),
	"matched_by" text
);
--> statement-breakpoint
CREATE TABLE "matching_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"priority" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"rule_type" text NOT NULL,
	"is_internal" boolean DEFAULT false,
	"date_must_match" boolean DEFAULT true,
	"date_tolerance_days" integer DEFAULT 0,
	"compare_currency" text DEFAULT 'local',
	"allow_tolerance" boolean DEFAULT false,
	"tolerance_amount" numeric(18, 2) DEFAULT '0',
	"conditions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parser_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"file_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"import_id" uuid,
	"account_number" text,
	"amount" numeric(18, 2) NOT NULL,
	"foreign_amount" numeric(18, 2),
	"currency" text DEFAULT 'NOK',
	"date1" date NOT NULL,
	"reference" text,
	"description" text,
	"text_code" text,
	"dim1" text,
	"dim2" text,
	"dim3" text,
	"dim4" text,
	"dim5" text,
	"dim6" text,
	"dim7" text,
	"sign" text,
	"match_id" uuid,
	"match_status" text DEFAULT 'unmatched',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_set1_account_id_accounts_id_fk" FOREIGN KEY ("set1_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_set2_account_id_accounts_id_fk" FOREIGN KEY ("set2_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_company_id_companies_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_parser_config_id_parser_configs_id_fk" FOREIGN KEY ("parser_config_id") REFERENCES "public"."parser_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_rule_id_matching_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."matching_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matching_rules" ADD CONSTRAINT "matching_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_companies_tenant" ON "companies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_matching_rules_client" ON "matching_rules" USING btree ("client_id","priority");--> statement-breakpoint
CREATE INDEX "idx_matching_rules_tenant" ON "matching_rules" USING btree ("tenant_id","priority");--> statement-breakpoint
CREATE INDEX "idx_transactions_client_set" ON "transactions" USING btree ("client_id","set_number");--> statement-breakpoint
CREATE INDEX "idx_transactions_unmatched" ON "transactions" USING btree ("client_id","set_number","match_status");--> statement-breakpoint
CREATE INDEX "idx_transactions_amount" ON "transactions" USING btree ("client_id","amount");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "transactions" USING btree ("client_id","date1");