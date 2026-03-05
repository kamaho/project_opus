import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, companies } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const GET = withTenant(async (req, { tenantId }) => {
  const companyId = new URL(req.url).searchParams.get("companyId");

  const companyWhere = companyId
    ? and(eq(companies.tenantId, tenantId), eq(companies.id, companyId))
    : eq(companies.tenantId, tenantId);

  const companyClause = companyId
    ? sql`co.tenant_id = ${tenantId} AND co.id = ${companyId}`
    : sql`co.tenant_id = ${tenantId}`;

  const [[clientCount], [stats]] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(companyWhere),
    db.execute<{
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
      WHERE ${companyClause}
    `),
  ]);

  return NextResponse.json({
    totalClients: Number(clientCount?.total ?? 0),
    activeReconciliations: Number(stats?.active_clients ?? 0),
    totalUnmatched: Number(stats?.unmatched_count ?? 0),
    totalDifference: parseFloat(String(stats?.total_diff ?? "0")),
  });
});
