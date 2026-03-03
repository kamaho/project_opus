ALTER TABLE "accounts" ALTER COLUMN "tripletex_account_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "tripletex_company_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ALTER COLUMN "tripletex_company_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ALTER COLUMN "set1_tripletex_account_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ALTER COLUMN "set2_tripletex_account_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ALTER COLUMN "last_sync_posting_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "tripletex_sync_configs" ALTER COLUMN "last_sync_bank_tx_id" SET DATA TYPE bigint;