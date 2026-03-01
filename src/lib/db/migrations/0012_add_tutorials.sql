-- Tutorial system tables (global, not tenant-scoped)

CREATE TABLE IF NOT EXISTS tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  pathname_pattern TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutorials_pathname ON tutorials (pathname_pattern);

CREATE TABLE IF NOT EXISTS tutorial_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  element_selector TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pathname TEXT,
  tooltip_position TEXT NOT NULL DEFAULT 'bottom',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutorial_steps_tutorial ON tutorial_steps (tutorial_id, step_order);

CREATE TABLE IF NOT EXISTS tutorial_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  org_role TEXT,
  org_id TEXT
);

CREATE TABLE IF NOT EXISTS tutorial_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tutorial_completions_unique ON tutorial_completions (tutorial_id, user_id);
