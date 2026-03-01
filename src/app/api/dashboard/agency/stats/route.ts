import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, companies } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }) => {
  const [clientCount] = await db
    .select({ total: sql<number>`count(*)` })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(eq(companies.tenantId, tenantId));

  const [stats] = await db.execute<{
    unmatched_count: string;
    total_diff: string;
    active_clients: string;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE t.match_status = 'unmatched') AS unmatched_count,
      COALESCE(SUM(t.amount::numeric) FILTER (WHERE t.match_status = 'unmatched'), 0) AS total_diff,
      COUNT(DISTINCT t.client_id) FILTER (WHERE t.match_status = 'unmatched') AS active_clients
    FROM transactions t
    INNER JOIN clients c ON c.id = t.client_id
    INNER JOIN companies co ON co.id = c.company_id
    WHERE co.tenant_id = ${tenantId}
  `);

  return NextResponse.json({
    totalClients: Number(clientCount?.total ?? 0),
    activeReconciliations: Number(stats?.active_clients ?? 0),
    totalUnmatched: Number(stats?.unmatched_count ?? 0),
    totalDifference: parseFloat(String(stats?.total_diff ?? "0")),
  });
});
