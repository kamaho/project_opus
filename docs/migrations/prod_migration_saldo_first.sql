-- ============================================================================
-- Migration: Saldo-first architecture
-- Run after deploying the schema migration (0009_brainy_black_tom.sql)
-- ============================================================================

-- 1. Create account_sync_settings table + indexes (from Drizzle migration)
-- This is handled by 0009_brainy_black_tom.sql — run that FIRST.

-- 2. Populate account_sync_settings for existing accounts that have transactions
-- These are accounts that were already set up via the old flow and have active sync configs.
INSERT INTO account_sync_settings (
  tenant_id,
  company_id,
  account_number,
  account_name,
  tripletex_account_id,
  account_type,
  sync_level,
  client_id,
  activated_at,
  last_balance_sync_at,
  tx_count,
  created_at,
  updated_at
)
SELECT DISTINCT ON (c2.tenant_id, cl.company_id, a.account_number)
  c2.tenant_id,
  cl.company_id,
  a.account_number,
  a.name AS account_name,
  COALESCE(a.tripletex_account_id, 0) AS tripletex_account_id,
  a.account_type,
  'transactions' AS sync_level,
  cl.id AS client_id,
  sc.created_at AS activated_at,
  sc.last_sync_at AS last_balance_sync_at,
  (SELECT COUNT(*)::int FROM transactions t WHERE t.client_id = cl.id) AS tx_count,
  sc.created_at,
  NOW()
FROM tripletex_sync_configs sc
JOIN clients cl ON sc.client_id = cl.id
JOIN companies c2 ON cl.company_id = c2.id
JOIN accounts a ON cl.set1_account_id = a.id
WHERE sc.is_active = true
  AND a.tripletex_account_id IS NOT NULL
ON CONFLICT (tenant_id, company_id, account_number) DO NOTHING;

-- 3. Mark existing completed sync configs as initial_sync_completed
UPDATE tripletex_sync_configs
SET initial_sync_completed = true,
    account_count = (
      SELECT COUNT(*)::int
      FROM account_sync_settings ass
      WHERE ass.tenant_id = tripletex_sync_configs.tenant_id
        AND ass.company_id = (
          SELECT company_id FROM clients WHERE id = tripletex_sync_configs.client_id LIMIT 1
        )
    )
WHERE sync_status = 'completed';

-- 4. Verify migration
SELECT
  'account_sync_settings' AS table_name,
  COUNT(*) AS row_count,
  COUNT(DISTINCT tenant_id) AS tenant_count,
  COUNT(CASE WHEN sync_level = 'transactions' THEN 1 END) AS activated_count,
  COUNT(CASE WHEN sync_level = 'balance_only' THEN 1 END) AS balance_only_count
FROM account_sync_settings;
