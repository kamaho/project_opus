-- Add bulk_jobs table for progress tracking of long-running bulk operations
CREATE TABLE IF NOT EXISTS bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('smart_match', 'import')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total INTEGER NOT NULL,
  completed INTEGER DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_tenant ON bulk_jobs (tenant_id, created_at);
