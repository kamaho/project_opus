-- Add priority column to agent_report_configs for job ordering
-- Lower number = higher priority (0 = most urgent)
ALTER TABLE agent_report_configs
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 10;

-- Index for efficient priority-based job claiming
CREATE INDEX IF NOT EXISTS idx_agent_report_configs_due
  ON agent_report_configs (priority ASC, next_match_run ASC, next_report_run ASC)
  WHERE enabled = true AND locked_at IS NULL;
