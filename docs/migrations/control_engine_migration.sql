-- =============================================================================
-- CONTROL ENGINE MIGRATION
-- Adds control_configs table and extends control_results with new columns.
--
-- All statements are idempotent (IF NOT EXISTS). Safe to run multiple times.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Create control_configs table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS control_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  control_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  parameters JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_control_configs_tenant
  ON control_configs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_control_configs_lookup
  ON control_configs(tenant_id, control_type, company_id);

-- RLS
ALTER TABLE control_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS control_configs_tenant_isolation ON control_configs;
CREATE POLICY control_configs_tenant_isolation ON control_configs
  USING (tenant_id = current_setting('app.tenant_id', true));

-- ---------------------------------------------------------------------------
-- STEP 2: Add new columns to control_results
-- ---------------------------------------------------------------------------

-- FK to control_configs (nullable — results can exist without a config)
ALTER TABLE control_results
  ADD COLUMN IF NOT EXISTS config_id UUID REFERENCES control_configs(id) ON DELETE SET NULL;

-- Snapshot of parameters used for this run (reproducibility)
ALTER TABLE control_results
  ADD COLUMN IF NOT EXISTS parameters_used JSONB DEFAULT '{}';

-- Denormalized counts for fast aggregation queries
ALTER TABLE control_results
  ADD COLUMN IF NOT EXISTS deviation_count INTEGER;

ALTER TABLE control_results
  ADD COLUMN IF NOT EXISTS warning_count INTEGER;

ALTER TABLE control_results
  ADD COLUMN IF NOT EXISTS total_deviation_amount NUMERIC;

-- Index on config_id for lookups
CREATE INDEX IF NOT EXISTS idx_control_results_config
  ON control_results(config_id);

-- RLS on control_configs (control_results already has RLS from prior migration)
-- Ensure control_results RLS policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'control_results' AND policyname = 'control_results_tenant_isolation'
  ) THEN
    ALTER TABLE control_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY control_results_tenant_isolation ON control_results
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;
