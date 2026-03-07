import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lightweight cron fallback. The Railway worker handles the actual sync
 * processing (10 concurrent, no timeout). This cron only:
 * 1. Resets configs stuck in "syncing" for >15 min (stale lock from worker crash)
 * 2. Returns a health summary of sync state
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleReset = await db
    .update(tripletexSyncConfigs)
    .set({
      syncStatus: "failed",
      syncError: "Auto-reset: stuck in syncing state (cron watchdog)",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tripletexSyncConfigs.syncStatus, "syncing"),
        lt(tripletexSyncConfigs.updatedAt, sql`now() - interval '15 minutes'`)
      )
    )
    .returning({ id: tripletexSyncConfigs.id });

  const stats = await db.execute<{
    sync_status: string;
    total: number;
  }>(sql`
    SELECT sync_status, count(*)::int as total
    FROM tripletex_sync_configs
    WHERE is_active = true
    GROUP BY sync_status
  `);

  return NextResponse.json({
    role: "watchdog",
    staleReset: staleReset.length,
    stats: Array.from(stats),
    timestamp: new Date().toISOString(),
  });
}
