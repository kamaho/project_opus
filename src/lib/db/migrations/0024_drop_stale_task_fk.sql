-- Drop the stale FK constraint from migration 0019 that still references
-- regulatory_deadlines (now deadline_templates) instead of deadlines.
-- The correct FK (tasks_linked_deadline_id_deadlines_id_fk -> deadlines.id)
-- was added in migration 0021 and is unaffected.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_linked_deadline_id_fkey;
