-- Ensure client_groups has color and icon (idempotent for envs that already have 0010/0011)
ALTER TABLE client_groups
ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE client_groups
ADD COLUMN IF NOT EXISTS icon text;
