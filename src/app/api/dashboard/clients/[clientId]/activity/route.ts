import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imports, agentJobLogs, clients } from "@/lib/db/schema";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { eq, desc, and, isNull } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const clientId = params!.clientId;
  await verifyClientOwnership(clientId, tenantId);

  const [clientRow] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const clientName = clientRow?.name ?? "Klient";

  const recentImports = await db
    .select({
      id: imports.id,
      filename: imports.filename,
      recordCount: imports.recordCount,
      timestamp: imports.createdAt,
    })
    .from(imports)
    .where(and(eq(imports.clientId, clientId), isNull(imports.deletedAt)))
    .orderBy(desc(imports.createdAt))
    .limit(10);

  const recentJobs = await db
    .select({
      id: agentJobLogs.id,
      jobType: agentJobLogs.jobType,
      status: agentJobLogs.status,
      matchCount: agentJobLogs.matchCount,
      transactionCount: agentJobLogs.transactionCount,
      timestamp: agentJobLogs.createdAt,
    })
    .from(agentJobLogs)
    .where(eq(agentJobLogs.clientId, clientId))
    .orderBy(desc(agentJobLogs.createdAt))
    .limit(10);

  type ActivityItem = {
    id: string;
    type: string;
    title: string;
    description: string;
    clientName: string;
    timestamp: string;
  };

  const activities: ActivityItem[] = [];

  for (const imp of recentImports) {
    activities.push({
      id: imp.id,
      type: "import",
      title: "Import fullført",
      description: `${imp.recordCount ?? 0} transaksjoner importert`,
      clientName,
      timestamp: imp.timestamp?.toISOString() ?? "",
    });
  }

  for (const job of recentJobs) {
    const isMatch = job.jobType === "smart_match" || job.jobType === "both";
    activities.push({
      id: job.id,
      type: isMatch ? "match" : "report",
      title: isMatch ? "Smart Match kjørt" : "Rapport generert",
      description: isMatch
        ? `${job.matchCount ?? 0} av ${job.transactionCount ?? 0} transaksjoner matchet`
        : "Rapport generert",
      clientName,
      timestamp: job.timestamp?.toISOString() ?? "",
    });
  }

  activities.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

  return NextResponse.json(activities.slice(0, 20));
});
