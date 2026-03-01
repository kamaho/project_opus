-- Add optional color (hex) for group cards
ALTER TABLE client_groups
ADD COLUMN IF NOT EXISTS color text;
