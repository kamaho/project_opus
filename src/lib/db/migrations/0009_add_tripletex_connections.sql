CREATE TABLE IF NOT EXISTS "tripletex_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL,
  "consumer_token" text NOT NULL,
  "employee_token" text NOT NULL,
  "base_url" text NOT NULL DEFAULT 'https://tripletex.no/v2',
  "label" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "verified_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_tripletex_conn_tenant"
  ON "tripletex_connections" ("tenant_id");
