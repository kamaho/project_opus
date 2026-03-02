-- Add indexes on high-frequency FK columns that were missing from the initial schema.
-- All three columns are queried on every tenant-scoped request.
-- Uses IF NOT EXISTS so the migration is safe to run against any environment.

CREATE INDEX IF NOT EXISTS "idx_accounts_company" ON "accounts" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clients_company" ON "clients" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_client" ON "matches" USING btree ("client_id");
