-- Document requests: external document collection via magic link

CREATE TABLE IF NOT EXISTS document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_requests_token ON document_requests(token);
CREATE INDEX IF NOT EXISTS idx_document_requests_tenant ON document_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_contact ON document_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_task ON document_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_document_requests_status ON document_requests(status, expires_at);

CREATE TABLE IF NOT EXISTS document_request_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_request_files_request ON document_request_files(request_id);

-- Enable RLS
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_request_files ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses, as with other tables)
CREATE POLICY "service_role_all_document_requests" ON document_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_document_request_files" ON document_request_files
  FOR ALL TO service_role USING (true) WITH CHECK (true);
