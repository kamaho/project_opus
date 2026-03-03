import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error" | object> = {};
  let healthy = true;

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
    healthy = false;
  }

  try {
    const [webhookStats] = await db.execute<{
      stale_pending: number;
      total_pending: number;
      total_failed: number;
    }>(sql`
      SELECT
        count(*) FILTER (WHERE status = 'pending' AND process_after < now() - interval '10 minutes') AS stale_pending,
        count(*) FILTER (WHERE status = 'pending') AS total_pending,
        count(*) FILTER (WHERE status = 'failed') AS total_failed
      FROM webhook_inbox
    `);
    checks.webhookInbox = {
      stalePending: Number(webhookStats?.stale_pending ?? 0),
      totalPending: Number(webhookStats?.total_pending ?? 0),
      totalFailed: Number(webhookStats?.total_failed ?? 0),
    };
  } catch {
    checks.webhookInbox = "error";
  }

  return NextResponse.json(
    { status: healthy ? "healthy" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
