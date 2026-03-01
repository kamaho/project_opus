-- 0015: Add dashboard_configs table for per-user dashboard layout preferences
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  dashboard_type TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'overview',
  hidden_modules TEXT[] DEFAULT '{}'::text[],
  module_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_configs_unique
  ON dashboard_configs (tenant_id, user_id, dashboard_type);

CREATE INDEX IF NOT EXISTS idx_dashboard_configs_tenant
  ON dashboard_configs (tenant_id);

ALTER TABLE dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on dashboard_configs"
  ON dashboard_configs FOR ALL
  USING (true) WITH CHECK (true);
