import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and, lt, or, isNull, sql } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONCURRENT = 3;

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  const running: Promise<void>[] = [];

  async function next(): Promise<void> {
    const i = idx++;
    if (i >= tasks.length) return;
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
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueConfigs = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(
      and(
        eq(tripletexSyncConfigs.isActive, true),
        or(
          isNull(tripletexSyncConfigs.lastSyncAt),
          lt(
            tripletexSyncConfigs.lastSyncAt,
            sql`now() - (${tripletexSyncConfigs.syncIntervalMinutes} || ' minutes')::interval`
          )
        )
      )
    );

  type SyncOutcome = {
    configId: string;
    clientId: string;
    status: "success" | "error";
    result?: unknown;
    error?: string;
  };

  const tasks = dueConfigs.map((config) => async (): Promise<SyncOutcome> => {
    try {
      const result = await runFullSync(config.id);
      return {
        configId: config.id,
        clientId: config.clientId,
        status: "success",
        result,
      };
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "tripletex-cron", configId: config.id, clientId: config.clientId },
      });
      console.error(`[cron/tripletex-sync] Config ${config.id} failed:`, error);
      return {
        configId: config.id,
        clientId: config.clientId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const results = await runWithConcurrency(tasks, MAX_CONCURRENT);

  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    synced: results.length,
    succeeded: results.length - failed,
    failed,
    results,
    timestamp: now.toISOString(),
  });
}
