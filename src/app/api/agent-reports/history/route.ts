import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentJobLogs, clients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );

  const rows = await db
    .select({
      id: agentJobLogs.id,
      jobType: agentJobLogs.jobType,
      status: agentJobLogs.status,
      matchCount: agentJobLogs.matchCount,
      transactionCount: agentJobLogs.transactionCount,
      reportSent: agentJobLogs.reportSent,
      errorMessage: agentJobLogs.errorMessage,
      durationMs: agentJobLogs.durationMs,
      createdAt: agentJobLogs.createdAt,
      clientName: clients.name,
    })
    .from(agentJobLogs)
    .innerJoin(clients, eq(agentJobLogs.clientId, clients.id))
    .where(eq(agentJobLogs.tenantId, tenantId))
    .orderBy(desc(agentJobLogs.createdAt))
    .limit(limit);

  return NextResponse.json(rows);
});
