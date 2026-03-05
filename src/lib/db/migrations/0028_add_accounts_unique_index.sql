CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_company_account_number
ON accounts (company_id, account_number);
