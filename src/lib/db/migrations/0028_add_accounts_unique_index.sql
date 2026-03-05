DROP INDEX IF EXISTS idx_accounts_company_account_number;
CREATE UNIQUE INDEX idx_accounts_company_account_number
ON accounts (company_id, account_number, account_type);
