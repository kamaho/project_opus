-- Migration: Add Visma Business NXT integration support
-- Creates connection + sync config tables, extends existing tables with Visma-specific columns

-- 1. Create visma_nxt_connections table (OAuth tokens per tenant)
CREATE TABLE IF NOT EXISTS "visma_nxt_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "company_no" bigint,
  "customer_no" bigint,
  "webhook_subscription_ids" jsonb DEFAULT '[]'::jsonb,
  "label" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_visma_nxt_conn_tenant"
  ON "visma_nxt_connections" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_visma_nxt_conn_company_no"
  ON "visma_nxt_connections" ("company_no");

-- 2. Create visma_nxt_sync_configs table (per-client sync configuration)
CREATE TABLE IF NOT EXISTS "visma_nxt_sync_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients" ("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL,
  "visma_company_no" bigint NOT NULL,
  "set1_account_ids" jsonb DEFAULT '[]'::jsonb,
  "set2_account_ids" jsonb DEFAULT '[]'::jsonb,
  "enabled_fields" jsonb DEFAULT '{"description":true,"bilag":true,"faktura":false,"reference":true,"foreignAmount":false,"accountNumber":true}'::jsonb,
  "date_from" date NOT NULL,
  "last_sync_at" timestamp with time zone,
  "last_sync_cursor" text,
  "sync_interval_minutes" integer NOT NULL DEFAULT 60,
  "sync_status" text DEFAULT 'pending',
  "sync_error" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "initial_sync_completed" boolean DEFAULT false,
  "account_count" integer DEFAULT 0,
  "last_balance_sync_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_visma_nxt_sync_client"
  ON "visma_nxt_sync_configs" ("client_id");

CREATE INDEX IF NOT EXISTS "idx_visma_nxt_sync_active"
  ON "visma_nxt_sync_configs" ("is_active", "last_sync_at");

-- 3. Add Visma NXT columns to companies
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "visma_nxt_company_no" bigint;

-- 4. Add Visma NXT columns to accounts
ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "visma_nxt_account_id" bigint;

-- 5. Alter account_sync_settings:
--    - Relax tripletex_account_id from NOT NULL to nullable
--    - Add visma_nxt_account_id column
--    - Add CHECK constraint ensuring at least one external ID is present
ALTER TABLE "account_sync_settings"
  ALTER COLUMN "tripletex_account_id" DROP NOT NULL;

ALTER TABLE "account_sync_settings"
  ADD COLUMN IF NOT EXISTS "visma_nxt_account_id" bigint;

ALTER TABLE "account_sync_settings"
  ADD CONSTRAINT "chk_account_sync_external_id"
  CHECK ("tripletex_account_id" IS NOT NULL OR "visma_nxt_account_id" IS NOT NULL);
