-- Migration: 0021_add_deadline_system
-- Introduces deadline_templates + deadlines tables, migrates from regulatory_deadlines,
-- updates tasks FK, and adds mva_term_type/fiscal_year_end to companies.

BEGIN;

-- 1. Create deadline_templates
CREATE TABLE IF NOT EXISTS deadline_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('tax', 'payroll', 'reporting', 'reconciliation', 'custom')),
  periodicity TEXT NOT NULL DEFAULT 'bimonthly' CHECK (periodicity IN ('monthly', 'bimonthly', 'quarterly', 'annual')),
  due_date_rule JSONB NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deadline_templates_slug ON deadline_templates (slug);

-- 2. Migrate regulatory_deadlines -> deadline_templates (guarded for fresh installs)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'regulatory_deadlines') THEN
    INSERT INTO deadline_templates (id, name, slug, description, category, periodicity, due_date_rule, is_system, created_at)
    SELECT
      id,
      title,
      lower(replace(replace(obligation, ' ', '-'), '.', '')),
      description,
      CASE
        WHEN obligation ILIKE '%mva%' THEN 'tax'
        WHEN obligation ILIKE '%a-melding%' OR obligation ILIKE '%lønn%' THEN 'payroll'
        WHEN obligation ILIKE '%skatt%' THEN 'tax'
        WHEN obligation ILIKE '%regnskap%' THEN 'reporting'
        WHEN obligation ILIKE '%aksjonær%' THEN 'reporting'
        ELSE 'tax'
      END,
      CASE
        WHEN obligation ILIKE '%a-melding%' OR obligation ILIKE '%lønn%' THEN 'monthly'
        WHEN obligation ILIKE '%mva%' THEN 'bimonthly'
        WHEN obligation ILIKE '%regnskap%' THEN 'annual'
        ELSE 'annual'
      END,
      deadline_rule,
      true,
      created_at
    FROM regulatory_deadlines
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END $$;

-- 3. Create deadlines table
CREATE TABLE IF NOT EXISTS deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES deadline_templates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  period_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'on_track', 'at_risk', 'overdue', 'done')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deadlines_unique ON deadlines (tenant_id, company_id, template_id, period_label);
CREATE INDEX IF NOT EXISTS idx_deadlines_tenant_due ON deadlines (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_tenant_company ON deadlines (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_status_due ON deadlines (status, due_date);

-- 4. Add mva_term_type and fiscal_year_end to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS mva_term_type TEXT DEFAULT 'bimonthly';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_year_end TEXT DEFAULT '12-31';

-- 5. Generate deadline instances for tasks that have linked_deadline_id (guarded)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'regulatory_deadlines') THEN
    INSERT INTO deadlines (tenant_id, template_id, company_id, due_date, period_label, status)
    SELECT DISTINCT
      t.tenant_id,
      t.linked_deadline_id,
      t.company_id,
      COALESCE(t.due_date::date, CURRENT_DATE),
      'migrated',
      CASE
        WHEN t.status = 'completed' THEN 'done'
        WHEN t.due_date IS NOT NULL AND t.due_date::date < CURRENT_DATE AND t.status != 'completed' THEN 'overdue'
        ELSE 'not_started'
      END
    FROM tasks t
    WHERE t.linked_deadline_id IS NOT NULL
      AND t.company_id IS NOT NULL
    ON CONFLICT (tenant_id, company_id, template_id, period_label) DO NOTHING;

    -- 6. Update tasks.linked_deadline_id to point to deadlines
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS _new_linked_deadline_id UUID;

    UPDATE tasks t
    SET _new_linked_deadline_id = d.id
    FROM deadlines d
    WHERE t.linked_deadline_id IS NOT NULL
      AND d.template_id = t.linked_deadline_id
      AND d.tenant_id = t.tenant_id
      AND d.company_id = t.company_id
      AND d.period_label = 'migrated';

    -- 7. Drop old FK, swap column values, add new FK
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_linked_deadline_id_regulatory_deadlines_id_fk;

    UPDATE tasks SET linked_deadline_id = _new_linked_deadline_id WHERE _new_linked_deadline_id IS NOT NULL;

    ALTER TABLE tasks DROP COLUMN IF EXISTS _new_linked_deadline_id;

    -- 8. Rename old table (rollback safety — do not drop)
    ALTER TABLE regulatory_deadlines RENAME TO regulatory_deadlines_deprecated;
  END IF;
END $$;

DO $fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_linked_deadline_id_deadlines_id_fk') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_linked_deadline_id_deadlines_id_fk
      FOREIGN KEY (linked_deadline_id) REFERENCES deadlines(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $fk$;

-- 9. Create status recomputation trigger (fires on status AND linked_deadline_id changes)
CREATE OR REPLACE FUNCTION recalculate_deadline_status()
RETURNS TRIGGER AS $$
DECLARE
  dl_id UUID;
  old_dl_id UUID;
  total_count INT;
  completed_count INT;
  open_count INT;
  active_count INT;
  dl_due DATE;
  new_status TEXT;
BEGIN
  dl_id := NEW.linked_deadline_id;
  old_dl_id := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.linked_deadline_id END;

  -- Recalculate the NEW deadline
  IF dl_id IS NOT NULL THEN
    SELECT due_date INTO dl_due FROM deadlines WHERE id = dl_id;

    SELECT
      count(*) FILTER (WHERE status != 'cancelled'),
      count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status = 'open'),
      count(*) FILTER (WHERE status IN ('in_progress', 'waiting'))
    INTO total_count, completed_count, open_count, active_count
    FROM tasks
    WHERE linked_deadline_id = dl_id;

    IF total_count = 0 THEN
      new_status := 'not_started';
    ELSIF completed_count = total_count THEN
      new_status := 'done';
    ELSIF dl_due < CURRENT_DATE THEN
      new_status := 'overdue';
    ELSIF dl_due <= CURRENT_DATE + INTERVAL '3 days' AND open_count > 0 THEN
      new_status := 'at_risk';
    ELSIF active_count > 0 OR completed_count > 0 THEN
      new_status := 'on_track';
    ELSE
      new_status := 'not_started';
    END IF;

    UPDATE deadlines
    SET status = new_status,
        completed_at = CASE WHEN new_status = 'done' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = dl_id AND status IS DISTINCT FROM new_status;
  END IF;

  -- Also recalculate the OLD deadline if task moved between deadlines
  IF old_dl_id IS NOT NULL AND old_dl_id IS DISTINCT FROM dl_id THEN
    SELECT due_date INTO dl_due FROM deadlines WHERE id = old_dl_id;

    SELECT
      count(*) FILTER (WHERE status != 'cancelled'),
      count(*) FILTER (WHERE status = 'completed'),
      count(*) FILTER (WHERE status = 'open'),
      count(*) FILTER (WHERE status IN ('in_progress', 'waiting'))
    INTO total_count, completed_count, open_count, active_count
    FROM tasks
    WHERE linked_deadline_id = old_dl_id;

    IF total_count = 0 THEN
      new_status := 'not_started';
    ELSIF completed_count = total_count THEN
      new_status := 'done';
    ELSIF dl_due < CURRENT_DATE THEN
      new_status := 'overdue';
    ELSIF dl_due <= CURRENT_DATE + INTERVAL '3 days' AND open_count > 0 THEN
      new_status := 'at_risk';
    ELSIF active_count > 0 OR completed_count > 0 THEN
      new_status := 'on_track';
    ELSE
      new_status := 'not_started';
    END IF;

    UPDATE deadlines
    SET status = new_status,
        completed_at = CASE WHEN new_status = 'done' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = old_dl_id AND status IS DISTINCT FROM new_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalculate_deadline_status ON tasks;
DROP TRIGGER IF EXISTS trg_recalculate_deadline_status_insert ON tasks;
DROP TRIGGER IF EXISTS trg_recalculate_deadline_status_update ON tasks;

CREATE TRIGGER trg_recalculate_deadline_status_insert
  AFTER INSERT ON tasks
  FOR EACH ROW
  WHEN (NEW.linked_deadline_id IS NOT NULL)
  EXECUTE FUNCTION recalculate_deadline_status();

CREATE TRIGGER trg_recalculate_deadline_status_update
  AFTER UPDATE OF status, linked_deadline_id ON tasks
  FOR EACH ROW
  WHEN (COALESCE(NEW.linked_deadline_id, OLD.linked_deadline_id) IS NOT NULL)
  EXECUTE FUNCTION recalculate_deadline_status();

COMMIT;
