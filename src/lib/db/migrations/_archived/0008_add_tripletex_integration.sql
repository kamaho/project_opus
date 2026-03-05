-- Tripletex integration: link existing tables + sync config

-- companies: link to Tripletex company
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "tripletex_company_id" integer;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_companies_tripletex"
  ON "companies" ("tenant_id", "tripletex_company_id")
  WHERE "tripletex_company_id" IS NOT NULL;

-- accounts: link to Tripletex account
ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "tripletex_account_id" integer;

-- transactions: source tracking + external ID for dedup
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "source_type" text DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS "external_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_transactions_external_id"
  ON "transactions" ("client_id", "external_id")
  WHERE "external_id" IS NOT NULL;

-- Sync configuration per client
CREATE TABLE IF NOT EXISTS "tripletex_sync_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients" ("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL,
  "tripletex_company_id" integer NOT NULL,
  "set1_tripletex_account_id" integer,
  "set2_tripletex_account_id" integer,
  "date_from" date NOT NULL,
  "last_sync_at" timestamp with time zone,
  "last_sync_posting_id" integer,
  "last_sync_bank_tx_id" integer,
  "sync_interval_minutes" integer NOT NULL DEFAULT 60,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tripletex_sync_client"
  ON "tripletex_sync_configs" ("client_id");

CREATE INDEX IF NOT EXISTS "idx_tripletex_sync_active"
  ON "tripletex_sync_configs" ("is_active", "last_sync_at");

-- RLS for new table (matches existing pattern)
ALTER TABLE "tripletex_sync_configs" ENABLE ROW LEVEL SECURITY;
