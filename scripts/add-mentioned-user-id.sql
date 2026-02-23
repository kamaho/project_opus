-- Kjør denne i Supabase SQL Editor (Dashboard → SQL Editor)
-- Legger til kolonne for varslet bruker (f.eks. @mention i notat, gjenbrukes andre steder)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mentioned_user_id text;
