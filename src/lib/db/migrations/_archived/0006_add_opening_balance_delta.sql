-- Store how much a manual transaction added to opening balance, so we can reverse it on delete.
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "opening_balance_delta" numeric(18, 2) DEFAULT '0';

COMMENT ON COLUMN "transactions"."opening_balance_delta" IS 'For manual transactions: amount added to client opening balance when created. Reversed on delete.';
