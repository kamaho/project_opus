-- Add assignee_id to deadlines (the person responsible for the overall deadline)
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS assignee_id TEXT;

-- Index for filtering deadlines by assignee
CREATE INDEX IF NOT EXISTS idx_deadlines_assignee ON deadlines (assignee_id);

-- Composite index for the combined filter query:
-- d.assignee_id = X OR EXISTS(tasks WHERE linked_deadline_id = d.id AND assignee_id = X)
CREATE INDEX IF NOT EXISTS idx_tasks_linked_assignee ON tasks (linked_deadline_id, assignee_id);
