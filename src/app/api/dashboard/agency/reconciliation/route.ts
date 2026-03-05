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
    unmatched_amount: string;
    last_activity: string | null;
  }>(sql`
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      co.name AS company_name,
      COUNT(t.id) AS total_count,
      COUNT(t.id) FILTER (WHERE t.match_status = 'matched') AS matched_count,
      COUNT(t.id) FILTER (WHERE t.match_status = 'unmatched') AS unmatched_count,
      COALESCE(SUM(ABS(t.amount::numeric)) FILTER (WHERE t.match_status = 'unmatched'), 0) AS unmatched_amount,
      MAX(i.created_at)::text AS last_activity
    FROM clients c
    INNER JOIN companies co ON co.id = c.company_id
    LEFT JOIN transactions t ON t.client_id = c.id
    LEFT JOIN imports i ON i.client_id = c.id AND i.deleted_at IS NULL
    WHERE ${companyClause}
    GROUP BY c.id, c.name, co.name
    ORDER BY
      COALESCE(SUM(ABS(t.amount::numeric)) FILTER (WHERE t.match_status = 'unmatched'), 0) DESC
  `);

  type RawRow = {
    client_id: string;
    client_name: string;
    company_name: string;
    total_count: string;
    matched_count: string;
    unmatched_count: string;
    unmatched_amount: string;
    last_activity: string | null;
  };

  const allRows = (rows as unknown as RawRow[]);
  const totalClients = allRows.length;

  const result = allRows.map((r) => {
    const total = Number(r.total_count);
    const unmatched = Number(r.unmatched_count);

    return {
      clientId: r.client_id,
      clientName: r.client_name,
      companyName: r.company_name,
      unmatchedCount: unmatched,
      unmatchedAmount: parseFloat(String(r.unmatched_amount)),
      lastActivity: r.last_activity,
      status: total === 0 ? "no_data" : unmatched === 0 ? "completed" : "in_progress",
    };
  });

  return NextResponse.json({ clients: result, totalClients });
});
