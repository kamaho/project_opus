import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentJobLogs, clients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
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
    .where(eq(agentJobLogs.tenantId, orgId))
    .orderBy(desc(agentJobLogs.createdAt))
    .limit(limit);

  return NextResponse.json(rows);
}
