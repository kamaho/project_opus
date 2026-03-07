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
  process.env.SYNC_CONCURRENCY ?? "5",
  10
);
const FAILED_RETRY_MINUTES = 10;
const STALE_SYNCING_MINUTES = 15;
const PER_CONFIG_TIMEOUT_MS = 300_000; // 5 minutes

type SyncConfig = typeof tripletexSyncConfigs.$inferSelect;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [sync-poller] ${msg}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Sync timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

/** Safely read a field that might be camelCase or snake_case from raw SQL rows. */
function field(row: SyncConfig, camel: string, snake: string): unknown {
  return (row as Record<string, unknown>)[camel] ?? (row as Record<string, unknown>)[snake];
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

/**
 * Phase 1: Run syncCompany + syncAccountList once per unique Tripletex company.
 * This prevents N concurrent upserts of the same 500+ accounts.
 */
async function runAccountSyncPerCompany(configs: SyncConfig[]): Promise<void> {
  const seen = new Map<string, { companyId: number; tenantId: string; configId: string; clientId: string }>();

  for (const c of configs) {
    const companyId = field(c, "tripletexCompanyId", "tripletex_company_id") as number;
    const tenantId = field(c, "tenantId", "tenant_id") as string;
    const key = `${companyId}:${tenantId}`;
    if (!seen.has(key)) {
      seen.set(key, {
        companyId,
        tenantId,
        configId: c.id,
        clientId: String(field(c, "clientId", "client_id")),
      });
    }
  }

  log(`Account sync for ${seen.size} unique company/tenant pair(s)`);

  for (const [, info] of seen) {
    try {
      const { syncCompany, syncAccountList } = await import("../src/lib/tripletex/sync");
      const { db } = await import("../src/lib/db");
      const { clients } = await import("../src/lib/db/schema");

      const t0 = Date.now();
      await withTimeout(syncCompany(info.companyId, info.tenantId), 60_000);

      const [clientRow] = await db
        .select({ companyId: clients.companyId })
        .from(clients)
        .where(eq(clients.id, info.clientId))
        .limit(1);

      if (clientRow?.companyId) {
        await withTimeout(
          syncAccountList(info.companyId, clientRow.companyId, info.tenantId),
          120_000
        );
      }

      log(`Company ${info.companyId} account sync done in ${Date.now() - t0}ms`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Company ${info.companyId} account sync FAILED: ${msg.slice(0, 200)}`);
    }
  }
}

/**
 * Phase 2: Run posting/bankTx/balance sync per config with skipAccountSync=true.
 */
async function processSyncConfig(config: SyncConfig): Promise<void> {
  const configId = config.id;
  const clientId = String(field(config, "clientId", "client_id") ?? "unknown");
  const t0 = Date.now();

  try {
    const { runFullSync } = await import("../src/lib/tripletex/sync");
    const result = await withTimeout(
      runFullSync(configId, { skipAccountSync: true }),
      PER_CONFIG_TIMEOUT_MS
    );
    const dur = Date.now() - t0;
    log(
      `config=${configId.slice(0, 8)} client=${clientId.slice(0, 8)} ` +
        `completed in ${dur}ms — postings=${result.postings.inserted} bankTx=${result.bankTransactions.inserted}`
    );
  } catch (error) {
    const dur = Date.now() - t0;
    const msg = error instanceof Error ? error.message : String(error);
    log(`config=${configId.slice(0, 8)} FAILED after ${dur}ms: ${msg.slice(0, 200)}`);

    try {
      const { db } = await import("../src/lib/db");
      await db
        .update(tripletexSyncConfigs)
        .set({
          syncStatus: "failed",
          syncError: msg.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tripletexSyncConfigs.id, configId),
            eq(tripletexSyncConfigs.syncStatus, "syncing")
          )
        );
    } catch {
      log(`config=${configId.slice(0, 8)} failed to update DB status after error`);
    }
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

  await runAccountSyncPerCompany(configs);
  await runWithConcurrency(configs, SYNC_CONCURRENCY);

  return configs.length;
}
