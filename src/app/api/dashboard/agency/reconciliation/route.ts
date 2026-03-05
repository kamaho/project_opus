import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const GET = withTenant(async (req, { tenantId }) => {
  const companyId = new URL(req.url).searchParams.get("companyId");

  const companyClause = companyId
    ? sql`co.tenant_id = ${tenantId} AND co.id = ${companyId}`
    : sql`co.tenant_id = ${tenantId}`;

  const rows = await db.execute<{
    client_id: string;
    client_name: string;
    company_name: string;
    total_count: string;
    matched_count: string;
    unmatched_count: string;
    last_activity: string | null;
  }>(sql`
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      co.name AS company_name,
      COUNT(t.id) AS total_count,
      COUNT(t.id) FILTER (WHERE t.match_status = 'matched') AS matched_count,
      COUNT(t.id) FILTER (WHERE t.match_status = 'unmatched') AS unmatched_count,
      MAX(i.created_at)::text AS last_activity
    FROM clients c
    INNER JOIN companies co ON co.id = c.company_id
    LEFT JOIN transactions t ON t.client_id = c.id
    LEFT JOIN imports i ON i.client_id = c.id AND i.deleted_at IS NULL
    WHERE ${companyClause}
    GROUP BY c.id, c.name, co.name
    ORDER BY
      CASE WHEN COUNT(t.id) = 0 THEN 1 ELSE 0 END,
      CASE WHEN COUNT(t.id) > 0
        THEN COUNT(t.id) FILTER (WHERE t.match_status = 'matched')::float / COUNT(t.id)
        ELSE 0 END
  `);

  const result = (rows as unknown as Array<{
    client_id: string;
    client_name: string;
    company_name: string;
    total_count: string;
    matched_count: string;
    unmatched_count: string;
    last_activity: string | null;
  }>).map((r) => {
    const total = Number(r.total_count);
    const matched = Number(r.matched_count);
    const pct = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0;

    return {
      clientId: r.client_id,
      clientName: r.client_name,
      companyName: r.company_name,
      matchPercentage: pct,
      unmatchedCount: Number(r.unmatched_count),
      lastActivity: r.last_activity,
      status: total === 0 ? "no_data" : pct >= 100 ? "completed" : "in_progress",
    };
  });

  return NextResponse.json(result);
});
