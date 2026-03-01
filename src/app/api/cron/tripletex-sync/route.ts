import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and, lt, or, isNull, sql } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min max for Vercel

/**
 * GET /api/cron/tripletex-sync
 * Called by Vercel Cron (or external scheduler).
 * Syncs all active configs where enough time has elapsed since last sync.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

  const results: Array<{
    configId: string;
    clientId: string;
    status: "success" | "error";
    result?: unknown;
    error?: string;
  }> = [];

  for (const config of dueConfigs) {
    try {
      const result = await runFullSync(config.id);
      results.push({
        configId: config.id,
        clientId: config.clientId,
        status: "success",
        result,
      });
    } catch (error) {
      results.push({
        configId: config.id,
        clientId: config.clientId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    timestamp: now.toISOString(),
  });
}
