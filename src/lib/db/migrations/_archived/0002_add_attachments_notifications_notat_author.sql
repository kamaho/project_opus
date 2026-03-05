-- Add notat_author and notat_created_at to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notat_author text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notat_created_at timestamptz;

-- Create transaction_attachments table
CREATE TABLE IF NOT EXISTS transaction_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  content_type text,
  uploaded_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON transaction_attachments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_attachments_client ON transaction_attachments(client_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  from_user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean DEFAULT false,
  entity_type text,
  entity_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, created_at);
