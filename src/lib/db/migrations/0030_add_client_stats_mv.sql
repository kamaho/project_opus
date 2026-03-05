-- Materialized view for dashboard client stats
-- Replaces 6+ sequential COUNT/SUM queries with a single pre-computed lookup
-- Must be refreshed after sync/import operations

CREATE MATERIALIZED VIEW IF NOT EXISTS client_stats_mv AS
SELECT
  c.company_id,
  co.tenant_id,
  t.client_id,
  c.name AS client_name,
  co.name AS company_name,
  COUNT(*) FILTER (WHERE t.set_number = 1) AS set1_count,
  COUNT(*) FILTER (WHERE t.set_number = 2) AS set2_count,
  COUNT(*) FILTER (WHERE t.match_status = 'matched') AS matched_count,
  COUNT(*) FILTER (WHERE t.match_status = 'unmatched') AS unmatched_count,
  COALESCE(SUM(t.amount::numeric) FILTER (WHERE t.match_status = 'unmatched'), 0) AS unmatched_total,
  COALESCE(SUM(ABS(t.amount::numeric)) FILTER (WHERE t.match_status = 'unmatched'), 0) AS unmatched_abs_total,
  MAX(t.created_at) AS last_activity
FROM transactions t
JOIN clients c ON t.client_id = c.id
JOIN companies co ON c.company_id = co.id
GROUP BY c.company_id, co.tenant_id, t.client_id, c.name, co.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_stats_mv_pk
  ON client_stats_mv (tenant_id, client_id);

CREATE INDEX IF NOT EXISTS idx_client_stats_mv_company
  ON client_stats_mv (tenant_id, company_id);
