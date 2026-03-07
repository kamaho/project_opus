-- Reduce sync interval from 60 to 15 minutes for all active configs
-- This ensures data from Tripletex/Visma arrives within ~5–20 minutes via cron fallback
-- (webhook path is still faster at ~5–15 seconds when active)

UPDATE tripletex_sync_configs
SET sync_interval_minutes = 15
WHERE sync_interval_minutes = 60;

UPDATE visma_nxt_sync_configs
SET sync_interval_minutes = 15
WHERE sync_interval_minutes = 60;
