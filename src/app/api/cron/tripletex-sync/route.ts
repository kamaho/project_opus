import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and, lt, or, isNull, sql } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONCURRENT = 2;
const MAX_CONFIGS_PER_RUN = 6;
const GLOBAL_DEADLINE_MS = 240_000;
const PER_CONFIG_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)),
      ms
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  deadlineAt: number
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  const running: Promise<void>[] = [];

  async function next(): Promise<void> {
    const i = idx++;
    if (i >= tasks.length) return;
    if (Date.now() >= deadlineAt) {
      results[i] = { status: "skipped", error: "Global deadline reached" } as T;
      return;
    }
    results[i] = await tasks[i]();
    await next();
  }

  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    running.push(next());
  }
  await Promise.all(running);
  return results;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + GLOBAL_DEADLINE_MS;
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  await db
    .update(tripletexSyncConfigs)
    .set({
      syncStatus: "failed",
      syncError: "Auto-reset: stuck in syncing state (timeout)",
      updatedAt: now,
    })
    .where(
      and(
        eq(tripletexSyncConfigs.syncStatus, "syncing"),
        lt(tripletexSyncConfigs.updatedAt, sql`now() - interval '10 minutes'`)
      )
    );

  const dueConfigs = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(
      and(
        eq(tripletexSyncConfigs.isActive, true),
        sql`${tripletexSyncConfigs.syncStatus} != 'syncing'`,
        or(
          isNull(tripletexSyncConfigs.lastSyncAt),
          lt(
            tripletexSyncConfigs.lastSyncAt,
            sql`now() - (${tripletexSyncConfigs.syncIntervalMinutes} || ' minutes')::interval`
          )
        ),
        or(
          sql`${tripletexSyncConfigs.syncStatus} != 'failed'`,
          lt(
            tripletexSyncConfigs.updatedAt,
            sql`now() - interval '30 minutes'`
          )
        )
      )
    )
    .orderBy(tripletexSyncConfigs.lastSyncAt)
    .limit(MAX_CONFIGS_PER_RUN);

  type SyncOutcome = {
    configId: string;
    clientId: string;
    status: "success" | "error" | "skipped";
    result?: unknown;
    error?: string;
    durationMs?: number;
  };

  const tasks = dueConfigs.map((config) => async (): Promise<SyncOutcome> => {
    const t0 = Date.now();
    try {
      const result = await withTimeout(
        runFullSync(config.id),
        PER_CONFIG_TIMEOUT_MS,
        `config ${config.id}`
      );
      return {
        configId: config.id,
        clientId: config.clientId,
        status: "success",
        result,
        durationMs: Date.now() - t0,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "tripletex-cron", configId: config.id, clientId: config.clientId },
      });
      console.error(`[cron/tripletex-sync] Config ${config.id} failed after ${Date.now() - t0}ms:`, error);
      return {
        configId: config.id,
        clientId: config.clientId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - t0,
      };
    }
  });

  const results = await runWithConcurrency(tasks, MAX_CONCURRENT, deadlineAt);

  const failed = results.filter((r) => r.status === "error").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  return NextResponse.json({
    synced: results.length,
    succeeded: results.length - failed - skipped,
    failed,
    skipped,
    results,
    durationMs: Date.now() - startedAt,
    timestamp: now.toISOString(),
  });
}
