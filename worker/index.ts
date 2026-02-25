import "./env";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { agentReportConfigs } from "../src/lib/db/schema";
import { and, eq, lte, isNull, isNotNull, or, sql } from "drizzle-orm";
import { runJob } from "./job-runner";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10);
const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? "30000", 10);
const LOCK_TIMEOUT = parseInt(process.env.LOCK_TIMEOUT_MS ?? "600000", 10);
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

const client = postgres(DATABASE_URL, { max: CONCURRENCY + 1 });
export const db = drizzle(client, { schema });

let shuttingDown = false;
let activeJobs = 0;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [${WORKER_ID}] ${msg}`);
}

async function cleanStaleLocks() {
  const cutoff = new Date(Date.now() - LOCK_TIMEOUT);
  await db
    .update(agentReportConfigs)
    .set({ lockedAt: null, lockedBy: null })
    .where(
      and(
        isNotNull(agentReportConfigs.lockedAt),
        lte(agentReportConfigs.lockedAt, cutoff)
      )
    );
}

async function claimDueConfigs(): Promise<typeof agentReportConfigs.$inferSelect[]> {
  const now = new Date();

  const rows = await db
    .select()
    .from(agentReportConfigs)
    .where(
      and(
        eq(agentReportConfigs.enabled, true),
        isNull(agentReportConfigs.lockedAt),
        or(
          lte(agentReportConfigs.nextMatchRun, now),
          lte(agentReportConfigs.nextReportRun, now)
        )
      )
    )
    .limit(CONCURRENCY - activeJobs);

  const claimed: typeof agentReportConfigs.$inferSelect[] = [];

  for (const row of rows) {
    const [locked] = await db
      .update(agentReportConfigs)
      .set({ lockedAt: now, lockedBy: WORKER_ID })
      .where(
        and(
          eq(agentReportConfigs.id, row.id),
          isNull(agentReportConfigs.lockedAt)
        )
      )
      .returning();

    if (locked) claimed.push(locked);
  }

  return claimed;
}

async function unlock(configId: string) {
  await db
    .update(agentReportConfigs)
    .set({ lockedAt: null, lockedBy: null })
    .where(eq(agentReportConfigs.id, configId));
}

async function processConfig(config: typeof agentReportConfigs.$inferSelect) {
  activeJobs++;
  try {
    log(`Processing config ${config.id} for client ${config.clientId}`);
    await runJob(db, config);
    log(`Completed config ${config.id}`);
  } catch (err) {
    log(`Error processing config ${config.id}: ${err instanceof Error ? err.message : err}`);
  } finally {
    await unlock(config.id);
    activeJobs--;
  }
}

async function poll() {
  if (shuttingDown) return;

  try {
    await cleanStaleLocks();

    if (activeJobs >= CONCURRENCY) return;

    const configs = await claimDueConfigs();
    if (configs.length > 0) {
      log(`Claimed ${configs.length} due config(s)`);
    }

    for (const cfg of configs) {
      processConfig(cfg);
    }
  } catch (err) {
    log(`Poll error: ${err instanceof Error ? err.message : err}`);
  }
}

async function shutdown(signal: string) {
  log(`${signal} received, shutting down gracefully...`);
  shuttingDown = true;

  const maxWait = 60_000;
  const start = Date.now();
  while (activeJobs > 0 && Date.now() - start < maxWait) {
    log(`Waiting for ${activeJobs} active job(s)...`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (activeJobs > 0) {
    log(`Force exiting with ${activeJobs} active job(s)`);
  }

  await client.end();
  log("Shutdown complete");
  process.exit(0);
}

async function main() {
  log(`Starting worker (concurrency=${CONCURRENCY}, poll=${POLL_INTERVAL}ms)`);

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  while (!shuttingDown) {
    await poll();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch((err) => {
  console.error("Worker fatal error:", err);
  process.exit(1);
});
