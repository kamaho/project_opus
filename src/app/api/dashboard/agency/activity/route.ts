import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imports, clients, companies, agentJobLogs } from "@/lib/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }) => {
  const [recentImports, recentJobs] = await Promise.all([
    db
      .select({
        id: imports.id,
        filename: imports.filename,
        recordCount: imports.recordCount,
        clientName: clients.name,
        timestamp: imports.createdAt,
      })
      .from(imports)
      .innerJoin(clients, eq(imports.clientId, clients.id))
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(and(eq(companies.tenantId, tenantId), isNull(imports.deletedAt)))
      .orderBy(desc(imports.createdAt))
      .limit(10),
    db
      .select({
        id: agentJobLogs.id,
        jobType: agentJobLogs.jobType,
        status: agentJobLogs.status,
        matchCount: agentJobLogs.matchCount,
        transactionCount: agentJobLogs.transactionCount,
        clientId: agentJobLogs.clientId,
        timestamp: agentJobLogs.createdAt,
      })
      .from(agentJobLogs)
      .where(eq(agentJobLogs.tenantId, tenantId))
      .orderBy(desc(agentJobLogs.createdAt))
      .limit(10),
  ]);

  const jobClientIds = [...new Set(recentJobs.map((j) => j.clientId))];
  const clientNames: Record<string, string> = {};
  if (jobClientIds.length > 0) {
    const rows = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(eq(companies.tenantId, tenantId));
    for (const r of rows) clientNames[r.id] = r.name;
  }

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
      description: `${imp.recordCount ?? 0} transaksjoner importert for ${imp.clientName}`,
      clientName: imp.clientName,
      timestamp: imp.timestamp?.toISOString() ?? "",
    });
  }

  for (const job of recentJobs) {
    const name = clientNames[job.clientId] ?? "Ukjent klient";
    const isMatch = job.jobType === "smart_match" || job.jobType === "both";
    activities.push({
      id: job.id,
      type: isMatch ? "match" : "report",
      title: isMatch ? "Smart Match kjørt" : "Rapport generert",
      description: isMatch
        ? `${job.matchCount ?? 0} av ${job.transactionCount ?? 0} transaksjoner matchet for ${name}`
        : `Rapport generert for ${name}`,
      clientName: name,
      timestamp: job.timestamp?.toISOString() ?? "",
    });
  }

  activities.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));

  return NextResponse.json(activities.slice(0, 20));
});
