-- =============================================================================
-- PROD MIGRATION — 2026-03-02
-- Brings production database (pejkokemdzsekboaebmy) up to date with dev schema.
--
-- Run order matters due to foreign-key dependencies.
-- All statements are idempotent (IF NOT EXISTS / IF NOT EXISTS for columns).
-- Safe to run multiple times.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Add missing columns to existing tables
-- ---------------------------------------------------------------------------

-- accounts.tripletex_account_id
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tripletex_account_id integer;

-- clients.assigned_user_id
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_user_id text;

-- companies.tripletex_company_id
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tripletex_company_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tripletex
  ON companies (tenant_id, tripletex_company_id)
  WHERE tripletex_company_id IS NOT NULL;

-- transactions.source_type, external_id
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'file';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id
  ON transactions (client_id, external_id)
  WHERE external_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- STEP 2: New standalone tables (no dependencies on other new tables)
-- ---------------------------------------------------------------------------

-- contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text,
  company text,
  phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts (tenant_id);

-- client_groups
CREATE TABLE IF NOT EXISTS client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  description text,
  color text,
  icon text,
  assigned_user_id text,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_groups_tenant ON client_groups (tenant_id);

-- client_group_members
CREATE TABLE IF NOT EXISTS client_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES client_groups (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_client_group_members_group ON client_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_client_group_members_client ON client_group_members (client_id);

-- reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  report_type text NOT NULL,
  title text NOT NULL,
  format text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  summary jsonb NOT NULL,
  config jsonb NOT NULL,
  period_year integer,
  period_month integer,
  as_of_date timestamptz,
  source_system text NOT NULL,
  generated_by text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reports_company ON reports (company_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports (report_type);

-- tripletex_connections
CREATE TABLE IF NOT EXISTS tripletex_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  consumer_token text NOT NULL,
  employee_token text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://tripletex.no/v2',
  label text,
  is_active boolean NOT NULL DEFAULT true,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tripletex_conn_tenant
  ON tripletex_connections (tenant_id);

-- tripletex_sync_configs (full schema including later-added array/json fields)
CREATE TABLE IF NOT EXISTS tripletex_sync_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  tripletex_company_id integer NOT NULL,
  set1_tripletex_account_id integer,
  set2_tripletex_account_id integer,
  set1_tripletex_account_ids jsonb DEFAULT '[]'::jsonb,
  set2_tripletex_account_ids jsonb DEFAULT '[]'::jsonb,
  enabled_fields jsonb DEFAULT '{"description":true,"bilag":true,"faktura":false,"reference":true,"foreignAmount":false,"accountNumber":true}'::jsonb,
  date_from date NOT NULL,
  last_sync_at timestamptz,
  last_sync_posting_id integer,
  last_sync_bank_tx_id integer,
  sync_interval_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tripletex_sync_client
  ON tripletex_sync_configs (client_id);
CREATE INDEX IF NOT EXISTS idx_tripletex_sync_active
  ON tripletex_sync_configs (is_active, last_sync_at);
ALTER TABLE tripletex_sync_configs ENABLE ROW LEVEL SECURITY;

-- tutorials
CREATE TABLE IF NOT EXISTS tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  pathname_pattern text NOT NULL,
  created_by_user_id text NOT NULL,
  visibility text NOT NULL DEFAULT 'all',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutorials_pathname ON tutorials (pathname_pattern);

CREATE TABLE IF NOT EXISTS tutorial_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES tutorials (id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  element_selector text NOT NULL,
  title text NOT NULL,
  description text,
  pathname text,
  tooltip_position text NOT NULL DEFAULT 'bottom',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tutorial_steps_tutorial
  ON tutorial_steps (tutorial_id, step_order);

CREATE TABLE IF NOT EXISTS tutorial_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES tutorials (id) ON DELETE CASCADE,
  org_role text,
  org_id text
);

CREATE TABLE IF NOT EXISTS tutorial_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id uuid NOT NULL REFERENCES tutorials (id) ON DELETE CASCADE,
  user_id text NOT NULL,
  completed_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tutorial_completions_unique
  ON tutorial_completions (tutorial_id, user_id);

-- dashboard_configs
CREATE TABLE IF NOT EXISTS dashboard_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  dashboard_type text NOT NULL,
  layout text NOT NULL DEFAULT 'overview',
  hidden_modules text[] DEFAULT '{}'::text[],
  module_settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_configs_unique
  ON dashboard_configs (tenant_id, user_id, dashboard_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_tenant
  ON dashboard_configs (tenant_id);
ALTER TABLE dashboard_configs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dashboard_configs'
      AND policyname = 'Service role full access on dashboard_configs'
  ) THEN
    CREATE POLICY "Service role full access on dashboard_configs"
      ON dashboard_configs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- calendar_events (must exist before tasks)
CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('meeting', 'reminder', 'custom_deadline')),
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean DEFAULT false,
  color text,
  created_by text NOT NULL,
  attendees text[] DEFAULT '{}'::text[],
  reminder_minutes_before integer,
  recurrence text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cal_events_tenant ON calendar_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_cal_events_range
  ON calendar_events (tenant_id, start_at, end_at);

-- control_results
CREATE TABLE IF NOT EXISTS control_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients (id) ON DELETE SET NULL,
  control_type text NOT NULL,
  period_year integer,
  period_month integer,
  period_quarter integer,
  as_of_date timestamptz,
  overall_status text NOT NULL,
  summary jsonb NOT NULL,
  deviations jsonb NOT NULL,
  source_system text NOT NULL,
  report_pdf_url text,
  report_excel_url text,
  executed_at timestamptz DEFAULT now(),
  executed_by text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_results_tenant ON control_results (tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_results_company ON control_results (company_id);
CREATE INDEX IF NOT EXISTS idx_control_results_type ON control_results (control_type);
CREATE INDEX IF NOT EXISTS idx_control_results_type_period
  ON control_results (control_type, period_year, period_month);


-- ---------------------------------------------------------------------------
-- STEP 3: Tasks — depends on contacts, calendar_events, regulatory_deadlines
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  company_id uuid REFERENCES companies (id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients (id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  category text,
  assignee_id text,
  external_contact_id uuid REFERENCES contacts (id) ON DELETE SET NULL,
  notify_external boolean DEFAULT false,
  created_by text NOT NULL,
  due_date date,
  completed_at timestamptz,
  completed_by text,
  resolution text,
  linked_deadline_id uuid REFERENCES regulatory_deadlines (id) ON DELETE SET NULL,
  linked_event_id uuid REFERENCES calendar_events (id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (tenant_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks (client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_linked_deadline
  ON tasks (tenant_id, linked_deadline_id) WHERE linked_deadline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_linked_event
  ON tasks (tenant_id, linked_event_id) WHERE linked_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_tasks_external_contact ON tasks (external_contact_id);


-- ---------------------------------------------------------------------------
-- STEP 4: Document requests — depends on tasks, contacts, clients, transactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  token text NOT NULL UNIQUE,
  task_id uuid REFERENCES tasks (id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients (id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES transactions (id) ON DELETE SET NULL,
  contact_id uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
  created_by text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_requests_token
  ON document_requests (token);
CREATE INDEX IF NOT EXISTS idx_document_requests_tenant
  ON document_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_contact
  ON document_requests (contact_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_task
  ON document_requests (task_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status
  ON document_requests (status, expires_at);
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_requests'
      AND policyname = 'service_role_all_document_requests'
  ) THEN
    CREATE POLICY "service_role_all_document_requests" ON document_requests
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_request_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES document_requests (id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  content_type text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_request_files_request
  ON document_request_files (request_id);
ALTER TABLE document_request_files ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'document_request_files'
      AND policyname = 'service_role_all_document_request_files'
  ) THEN
    CREATE POLICY "service_role_all_document_request_files" ON document_request_files
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
