-- Generic mentioned-user field (e.g. for notat @mention, reusable elsewhere)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mentioned_user_id text;
