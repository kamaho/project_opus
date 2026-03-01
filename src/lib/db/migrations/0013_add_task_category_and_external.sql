-- Add category, external contact, and notify fields to tasks
ALTER TABLE "tasks" ADD COLUMN "category" text;
ALTER TABLE "tasks" ADD COLUMN "external_contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" ADD COLUMN "notify_external" boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_tasks_category" ON "tasks" ("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "idx_tasks_external_contact" ON "tasks" ("external_contact_id");
