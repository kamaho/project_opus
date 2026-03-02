CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "type" text NOT NULL CHECK ("type" IN ('meeting', 'reminder', 'custom_deadline')),
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz,
  "all_day" boolean DEFAULT false,
  "color" text,
  "created_by" text NOT NULL,
  "attendees" text[] DEFAULT '{}'::text[],
  "reminder_minutes_before" integer,
  "recurrence" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cal_events_tenant" ON "calendar_events" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_cal_events_range" ON "calendar_events" ("tenant_id", "start_at", "end_at");
