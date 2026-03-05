import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Refresh the client_stats_mv materialized view.
 * CONCURRENTLY allows reads during refresh (requires the unique index).
 * Call after sync, import, match, or unmatch operations.
 */
export async function refreshClientStats(): Promise<void> {
  try {
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY client_stats_mv`);
  } catch (err) {
    console.warn("[refresh-stats] Failed to refresh client_stats_mv:", err);
  }
}
