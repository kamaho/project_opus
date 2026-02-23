-- If you previously ran 0003 with notat_mentioned_user_id, rename to mentioned_user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'notat_mentioned_user_id'
  ) THEN
    ALTER TABLE transactions RENAME COLUMN notat_mentioned_user_id TO mentioned_user_id;
  END IF;
END $$;
