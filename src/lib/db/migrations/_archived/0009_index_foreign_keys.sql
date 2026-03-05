-- Index all foreign key columns that lack a covering index (Supabase "Unindexed foreign keys").
-- Improves: deletes/updates on parent rows, joins and filters on FK columns, cascades.
-- For zero-downtime in production, run each CREATE INDEX CONCURRENTLY outside a transaction.

-- accounts
CREATE INDEX IF NOT EXISTS idx_accounts_company_id ON public.accounts (company_id);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients (company_id);
CREATE INDEX IF NOT EXISTS idx_clients_set1_account_id ON public.clients (set1_account_id);
CREATE INDEX IF NOT EXISTS idx_clients_set2_account_id ON public.clients (set2_account_id);

-- companies (self-reference)
CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id ON public.companies (parent_company_id);

-- imports (client_id already covered by idx_imports_client_set; add parser_config_id)
CREATE INDEX IF NOT EXISTS idx_imports_parser_config_id ON public.imports (parser_config_id);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_client_id ON public.matches (client_id);
CREATE INDEX IF NOT EXISTS idx_matches_rule_id ON public.matches (rule_id);

-- knowledge_snippets
CREATE INDEX IF NOT EXISTS idx_knowledge_snippets_article_id ON public.knowledge_snippets (article_id);

-- client_funds_accounts (company_id has idx_client_funds_company; add the rest)
CREATE INDEX IF NOT EXISTS idx_client_funds_bank_account_id ON public.client_funds_accounts (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_client_funds_ledger_account_id ON public.client_funds_accounts (ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_client_funds_liability_account_id ON public.client_funds_accounts (liability_account_id);

-- saved_mappings (client_id for FK from clients)
CREATE INDEX IF NOT EXISTS idx_saved_mappings_client_id ON public.saved_mappings (client_id);

-- report_snapshots (company_id already in idx_report_snapshots_company)
-- balance_checkpoints (client_id already in idx_bc_client_date)
-- agent_report_configs (client_id in idx_agent_config_client)
-- agent_job_logs (config_id in idx_agent_logs_config, client_id in idx_agent_logs_client)
-- transaction_attachments (both FKs indexed)
-- transactions (all FKs indexed)
-- accrual_entries (already indexed)
-- client_report_types (client_id in idx_crt_client_type)
-- matching_rules (client_id in idx_matching_rules_client)
