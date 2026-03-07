import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../src/lib/db/schema";
import { tripletexSyncConfigs } from "../src/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

type Db = PostgresJsDatabase<typeof schema>;

const SYNC_BATCH_SIZE = parseInt(
  process.env.SYNC_BATCH_SIZE ?? "20",
  10
);
const SYNC_CONCURRENCY = parseInt(
  process.env.SYNC_CONCURRENCY ?? "10",
  10
);
const FAILED_RETRY_MINUTES = 10;
const STALE_SYNCING_MINUTES = 15;

type SyncConfig = typeof tripletexSyncConfigs.$inferSelect;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [sync-poller] ${msg}`);
}

async function resetStaleSyncing(db: Db): Promise<number> {
  const result = await db
    .update(tripletexSyncConfigs)
    .set({
      syncStatus: "failed",
      syncError: "Auto-reset: stuck in syncing state (worker timeout)",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tripletexSyncConfigs.syncStatus, "syncing"),
        lt(
          tripletexSyncConfigs.updatedAt,
          sql`now() - interval '${sql.raw(String(STALE_SYNCING_MINUTES))} minutes'`
        )
      )
    )
    .returning({ id: tripletexSyncConfigs.id });

  return result.length;
}

async function claimDueConfigs(db: Db): Promise<SyncConfig[]> {
  const claimed = await db.execute<SyncConfig>(sql`
    UPDATE tripletex_sync_configs
    SET sync_status = 'syncing', sync_error = NULL, updated_at = now()
    WHERE id IN (
      SELECT id FROM tripletex_sync_configs
      WHERE is_active = true
        AND sync_status != 'syncing'
        AND (
          last_sync_at IS NULL
          OR last_sync_at < now() - (sync_interval_minutes || ' minutes')::interval
        )
        AND (
          sync_status != 'failed'
          OR updated_at < now() - interval '${sql.raw(String(FAILED_RETRY_MINUTES))} minutes'
        )
      ORDER BY last_sync_at ASC NULLS FIRST
      LIMIT ${SYNC_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  return Array.from(claimed);
}

async function processSyncConfig(config: SyncConfig): Promise<void> {
  const configId = config.id;
  const clientId =
    config.clientId ?? (config as Record<string, unknown>)["client_id"] ?? "unknown";
  const t0 = Date.now();
  try {
    const { runFullSync } = await import("../src/lib/tripletex/sync");
    const result = await runFullSync(configId);
    const dur = Date.now() - t0;
    log(
      `config=${configId.slice(0, 8)} client=${String(clientId).slice(0, 8)} ` +
        `completed in ${dur}ms — postings=${result.postings.inserted} bankTx=${result.bankTransactions.inserted}`
    );
  } catch (error) {
    const dur = Date.now() - t0;
    const msg = error instanceof Error ? error.message : String(error);
    log(`config=${configId.slice(0, 8)} FAILED after ${dur}ms: ${msg.slice(0, 200)}`);
  }
}

async function runWithConcurrency(
  configs: SyncConfig[],
  concurrency: number
): Promise<void> {
  let idx = 0;

  async function next(): Promise<void> {
    while (idx < configs.length) {
      const config = configs[idx++];
      await processSyncConfig(config);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, configs.length) },
    () => next()
  );
  await Promise.all(workers);
}

/**
 * Single poll iteration: reset stale configs, claim due ones, process them.
 * Called by the worker on a 10s interval.
 */
export async function pollTripletexSync(db: Db): Promise<number> {
  const staleReset = await resetStaleSyncing(db);
  if (staleReset > 0) {
    log(`Reset ${staleReset} stale syncing config(s)`);
  }

  const configs = await claimDueConfigs(db);
  if (configs.length === 0) return 0;

  log(`Claimed ${configs.length} config(s) for sync`);
  await runWithConcurrency(configs, SYNC_CONCURRENCY);

  return configs.length;
}
