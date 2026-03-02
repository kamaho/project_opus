-- Link tasks to regulatory deadlines and calendar events
ALTER TABLE tasks ADD COLUMN linked_deadline_id uuid REFERENCES regulatory_deadlines(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN linked_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_linked_deadline ON tasks (tenant_id, linked_deadline_id) WHERE linked_deadline_id IS NOT NULL;
CREATE INDEX idx_tasks_linked_event ON tasks (tenant_id, linked_event_id) WHERE linked_event_id IS NOT NULL;
