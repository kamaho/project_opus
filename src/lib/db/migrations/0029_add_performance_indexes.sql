-- Performance indexes identified by codebase audit + scale analysis

-- agent_job_logs: dashboard activity queries filter on tenant_id
CREATE INDEX IF NOT EXISTS idx_agent_job_logs_tenant ON agent_job_logs (tenant_id);

-- knowledge_articles: queried by category and status
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles (category);

-- knowledge_snippets: queried by article_id
CREATE INDEX IF NOT EXISTS idx_knowledge_snippets_article ON knowledge_snippets (article_id);

-- account_sync_settings: sync lookups by tenant + tripletex_account_id
CREATE INDEX IF NOT EXISTS idx_account_sync_tripletex
  ON account_sync_settings (tenant_id, tripletex_account_id);
