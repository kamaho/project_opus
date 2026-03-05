import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../src/lib/db/schema";
import {
  webhookInbox,
  tripletexSyncConfigs,
  tripletexConnections,
  webhookSubscriptions,
  notifications,
  clients,
} from "../src/lib/db/schema";
import { eq, and, lte, sql, inArray } from "drizzle-orm";

type Db = PostgresJsDatabase<typeof schema>;

const MAX_ATTEMPTS = 5;
const BATCH_LIMIT = 50;

async function reportToSentry(
  error: unknown,
  context: Record<string, string>
): Promise<void> {
  try {
    const Sentry = await import("@sentry/node");
    Sentry.captureException(error, {
      tags: { component: "webhook-processor", ...context },
    });
  } catch {
    // Sentry not available in this runtime — no-op
  }
}

interface RawWebhookRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  source: string;
  event_type: string;
  external_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  process_after: string | null;
  processed_at: string | null;
  created_at: string | null;
}

interface WebhookGroup {
  tenantId: string;
  source: string;
  eventPrefix: string;
  eventIds: string[];
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [webhook-proc] ${msg}`);
}

function backoffDelay(attempts: number): number {
  return Math.min(30_000 * 2 ** attempts, 960_000); // 30s, 60s, 120s, 240s, 480s — max ~16 min
}

/**
 * Claims pending webhook events using FOR UPDATE SKIP LOCKED.
 * Returns claimed events grouped by (tenantId, source, eventPrefix) for debounce.
 */
async function claimPendingEvents(db: Db): Promise<{
  events: RawWebhookRow[];
  groups: WebhookGroup[];
}> {
  const now = new Date().toISOString();

  const events = await db.execute<RawWebhookRow>(sql`
    UPDATE webhook_inbox
    SET status = 'processing', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM webhook_inbox
      WHERE status = 'pending'
        AND process_after <= ${now}::timestamptz
        AND attempts < ${MAX_ATTEMPTS}
      ORDER BY process_after ASC
      LIMIT ${BATCH_LIMIT}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  if (events.length === 0) {
    return { events: [], groups: [] };
  }

  const groupMap = new Map<string, WebhookGroup>();
  for (const evt of events) {
    const eventPrefix = evt.event_type.split(".")[0];
    const key = `${evt.tenant_id}:${evt.source}:${eventPrefix}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        tenantId: evt.tenant_id,
        source: evt.source,
        eventPrefix,
        eventIds: [],
      });
    }
    groupMap.get(key)!.eventIds.push(evt.id);
  }

  return { events: Array.from(events), groups: Array.from(groupMap.values()) };
}

/**
 * Mark events as completed.
 */
async function markCompleted(db: Db, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(webhookInbox)
    .set({ status: "completed", processedAt: new Date() })
    .where(inArray(webhookInbox.id, ids));
}

/**
 * Mark events as failed with error and backoff.
 */
async function markFailed(db: Db, ids: string[], error: string) {
  if (ids.length === 0) return;

  const events = await db
    .select({
      id: webhookInbox.id,
      attempts: webhookInbox.attempts,
      tenantId: webhookInbox.tenantId,
      source: webhookInbox.source,
      eventType: webhookInbox.eventType,
    })
    .from(webhookInbox)
    .where(inArray(webhookInbox.id, ids));

  const permanentIds: string[] = [];
  const retryIds: string[] = [];
  const retryAfter = new Map<string, Date>();

  for (const evt of events) {
    const attempts = evt.attempts ?? 1;
    if (attempts >= MAX_ATTEMPTS) {
      permanentIds.push(evt.id);
      reportToSentry(new Error(`Webhook permanently failed: ${error}`), {
        webhookId: evt.id,
        tenantId: evt.tenantId ?? "unknown",
        source: evt.source ?? "unknown",
        eventType: evt.eventType ?? "unknown",
        attempts: String(attempts),
      });
    } else {
      retryIds.push(evt.id);
      retryAfter.set(evt.id, new Date(Date.now() + backoffDelay(attempts)));
    }
  }

  const truncatedError = error.slice(0, 2000);

  if (permanentIds.length > 0) {
    await db
      .update(webhookInbox)
      .set({ status: "failed", lastError: truncatedError })
      .where(inArray(webhookInbox.id, permanentIds));
  }

  if (retryIds.length > 0) {
    const maxBackoff = retryIds.reduce((max, id) => {
      const after = retryAfter.get(id)!;
      return after > max ? after : max;
    }, new Date(0));
    await db
      .update(webhookInbox)
      .set({
        status: "pending",
        lastError: truncatedError,
        processAfter: maxBackoff,
      })
      .where(inArray(webhookInbox.id, retryIds));
  }
}

/**
 * Process a group of debounced events by triggering the appropriate sync.
 */
async function processGroup(db: Db, group: WebhookGroup): Promise<void> {
  const { tenantId, source, eventPrefix, eventIds } = group;
  log(`Processing group: tenant=${tenantId} source=${source} type=${eventPrefix} events=${eventIds.length}`);

  try {
    if (source === "tripletex") {
      await processTripletexGroup(db, tenantId, eventPrefix, eventIds);
    } else {
      log(`Unknown source: ${source}, skipping`);
      await db
        .update(webhookInbox)
        .set({ status: "skipped", processedAt: new Date() })
        .where(inArray(webhookInbox.id, eventIds));
      return;
    }

    await markCompleted(db, eventIds);
    log(`Completed group: tenant=${tenantId} type=${eventPrefix} events=${eventIds.length}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`Failed group: tenant=${tenantId} type=${eventPrefix} error=${msg}`);
    await reportToSentry(error, {
      tenantId,
      source,
      eventPrefix,
      batchSize: String(eventIds.length),
    });
    await markFailed(db, eventIds, msg);

    if (eventPrefix === "sync") {
      try {
        await db.insert(notifications).values({
          tenantId,
          userId: "system",
          type: "system",
          title: "Synkronisering feilet",
          body: "Kunne ikke importere transaksjoner fra Tripletex. Systemet prøver igjen automatisk.",
          link: "/dashboard/settings",
        });
      } catch {
        log(`Failed to create failure notification for tenant=${tenantId}`);
      }
    }
  }
}

/**
 * Route Tripletex webhook events to the appropriate sync function.
 */
async function processTripletexGroup(
  db: Db,
  tenantId: string,
  eventPrefix: string,
  eventIds: string[]
): Promise<void> {
  switch (eventPrefix) {
    case "sync": {
      for (const id of eventIds) {
        const [evt] = await db
          .select({ payload: webhookInbox.payload, eventType: webhookInbox.eventType })
          .from(webhookInbox)
          .where(eq(webhookInbox.id, id))
          .limit(1);

        const payload = evt?.payload as Record<string, unknown> | null;
        const eventType = evt?.eventType ?? "";

        if (eventType === "sync.balances.requested") {
          const companyId = payload?.companyId as string;
          const payloadTenantId = (payload?.tenantId as string) || tenantId;
          if (!companyId) {
            log(`sync.balances.requested ${id}: no companyId in payload, skipping`);
            continue;
          }
          const { syncBalancesForAccounts } = await import("../src/lib/tripletex/sync");
          log(`Running balance sync for company=${companyId} tenant=${payloadTenantId}`);
          const result = await syncBalancesForAccounts(companyId, payloadTenantId);
          log(`Balance sync done: ${result.balancesUpdated} balances in ${result.duration}ms`);

          await db.insert(notifications).values({
            tenantId: payloadTenantId,
            userId: "system",
            type: "system",
            title: "Saldoer oppdatert",
            body: `${result.balancesUpdated} kontosaldoer hentet fra Tripletex.`,
            link: "/dashboard/clients",
          });
          continue;
        }

        const configId = (payload?.configId as string) ?? null;

        if (!configId) {
          log(`sync event ${id}: no configId in payload, skipping`);
          continue;
        }

        if (eventType === "sync.account.activated") {
          // Level 2: on-demand transaction sync for a single account
          const { syncTransactionsForAccount } = await import("../src/lib/tripletex/sync");
          log(`Running transaction sync for config=${configId} (account activated)`);
          const result = await syncTransactionsForAccount(configId);
          const total = result.postings.inserted + result.bankTransactions.inserted;
          log(`Account sync done for config=${configId}: ${total} transactions`);

          const accountNumber = (payload?.accountNumber as string) ?? "";
          const [config] = await db
            .select({ clientId: tripletexSyncConfigs.clientId })
            .from(tripletexSyncConfigs)
            .where(eq(tripletexSyncConfigs.id, configId))
            .limit(1);

          if (config) {
            await db.insert(notifications).values({
              tenantId,
              userId: "system",
              type: "system",
              title: "Konto klar for avstemming",
              body: `Konto ${accountNumber}: ${total} transaksjoner importert fra Tripletex.`,
              link: `/dashboard/clients/${config.clientId}`,
            });
          }
        } else {
          // sync.initial — full sync for backward compatibility
          const { runFullSync } = await import("../src/lib/tripletex/sync");
          log(`Running initial sync for config=${configId}`);
          const result = await runFullSync(configId);
          log(`Initial sync done for config=${configId}: postings=${result.postings.inserted}, bankTx=${result.bankTransactions.inserted}`);

          const [config] = await db
            .select({ clientId: tripletexSyncConfigs.clientId })
            .from(tripletexSyncConfigs)
            .where(eq(tripletexSyncConfigs.id, configId))
            .limit(1);

          if (config) {
            const clientRow = await db.execute<{ name: string }>(sql`
              SELECT name FROM clients WHERE id = ${config.clientId} LIMIT 1
            `);
            const clientName = Array.from(clientRow)[0]?.name ?? "Klient";
            const total = result.postings.inserted + result.bankTransactions.inserted;

            await db.insert(notifications).values({
              tenantId,
              userId: "system",
              type: "system",
              title: "Synkronisering fullført",
              body: `${clientName}: ${total} transaksjoner importert fra Tripletex.`,
              link: `/dashboard/clients/${config.clientId}`,
            });
          }
        }
      }
      break;
    }

    case "transaction": {
      // Only sync transactions for configs with activated accounts (sync_level = "transactions")
      const configs = await db
        .select()
        .from(tripletexSyncConfigs)
        .where(
          and(
            eq(tripletexSyncConfigs.tenantId, tenantId),
            eq(tripletexSyncConfigs.isActive, true)
          )
        );

      if (configs.length === 0) {
        log(`No active sync configs for tenant=${tenantId}, skipping transaction sync`);
        return;
      }

      const { syncTransactionsForAccount } = await import("../src/lib/tripletex/sync");
      for (const config of configs) {
        log(`Running incremental sync for config=${config.id}`);
        await syncTransactionsForAccount(config.id);
      }
      break;
    }

    case "account": {
      const configs = await db
        .select()
        .from(tripletexSyncConfigs)
        .where(eq(tripletexSyncConfigs.tenantId, tenantId));

      if (configs.length === 0) {
        log(`No sync configs for tenant=${tenantId}, skipping account sync`);
        return;
      }

      const { syncAccounts } = await import("../src/lib/tripletex/sync");

      const clientIds = configs.map((c) => c.clientId);
      const clientRows = await db
        .select({ id: clients.id, companyId: clients.companyId })
        .from(clients)
        .where(inArray(clients.id, clientIds));
      const companyByClient = new Map(clientRows.map((r) => [r.id, r.companyId]));

      for (const config of configs) {
        const companyId = companyByClient.get(config.clientId);
        if (companyId) {
          await syncAccounts(config.tripletexCompanyId, companyId, tenantId);
        }
      }
      break;
    }

    case "connection": {
      log(`Connection event for tenant=${tenantId} — deactivating`);
      await db
        .update(tripletexConnections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(tripletexConnections.tenantId, tenantId));

      await db
        .update(webhookSubscriptions)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(
          and(
            eq(webhookSubscriptions.tenantId, tenantId),
            eq(webhookSubscriptions.source, "tripletex")
          )
        );

      await db.insert(notifications).values({
        tenantId,
        userId: "system",
        type: "system",
        title: "Tripletex-tilkobling deaktivert",
        body: "Tripletex har trukket tilbake tilgangen. Koble til på nytt under Innstillinger > Integrasjoner.",
        link: "/dashboard/settings",
      });

      await db
        .update(webhookInbox)
        .set({ status: "skipped", processedAt: new Date() })
        .where(
          and(
            eq(webhookInbox.tenantId, tenantId),
            eq(webhookInbox.source, "tripletex"),
            eq(webhookInbox.status, "pending")
          )
        );
      break;
    }

    default:
      log(`Unhandled event prefix: ${eventPrefix} for tenant=${tenantId}`);
  }
}

/**
 * Main poll function for the webhook inbox processor.
 * Called by the Worker on a faster interval (5s).
 */
export async function pollWebhookInbox(db: Db): Promise<number> {
  const { groups } = await claimPendingEvents(db);

  if (groups.length === 0) return 0;

  log(`Claimed ${groups.length} group(s) for processing`);

  let processed = 0;
  for (const group of groups) {
    await processGroup(db, group);
    processed += group.eventIds.length;
  }

  return processed;
}
