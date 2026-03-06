import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { parseCompanyIds } from "@/lib/utils";

export const GET = withTenant(async (req, { tenantId }) => {
  const companyIds = parseCompanyIds(new URL(req.url).searchParams.get("companyId"));

  const companyClause = companyIds.length > 0
    ? sql`mv.tenant_id = ${tenantId} AND mv.company_id = ANY(${companyIds})`
    : sql`mv.tenant_id = ${tenantId}`;

  let rows: {
    client_id: string;
    client_name: string;
    company_name: string;
    total_count: string;
    matched_count: string;
    unmatched_count: string;
    unmatched_amount: string;
    last_activity: string | null;
  }[];

  try {
    rows = await db.execute(sql`
      SELECT
        mv.client_id,
        mv.client_name,
        mv.company_name,
        (mv.set1_count + mv.set2_count)::text AS total_count,
        mv.matched_count::text AS matched_count,
        mv.unmatched_count::text AS unmatched_count,
        mv.unmatched_abs_total::text AS unmatched_amount,
        mv.last_activity::text AS last_activity
      FROM client_stats_mv mv
      WHERE ${companyClause}
      ORDER BY mv.unmatched_abs_total DESC
    `) as typeof rows;
  } catch {
    const fallbackCompanyClause = companyIds.length > 0
      ? sql`co.tenant_id = ${tenantId} AND co.id = ANY(${companyIds})`
      : sql`co.tenant_id = ${tenantId}`;

    rows = await db.execute(sql`
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        co.name AS company_name,
        COUNT(t.id)::text AS total_count,
        COUNT(t.id) FILTER (WHERE t.match_status = 'matched')::text AS matched_count,
        COUNT(t.id) FILTER (WHERE t.match_status = 'unmatched')::text AS unmatched_count,
        COALESCE(SUM(ABS(t.amount::numeric)) FILTER (WHERE t.match_status = 'unmatched'), 0)::text AS unmatched_amount,
        MAX(t.created_at)::text AS last_activity
      FROM clients c
      INNER JOIN companies co ON co.id = c.company_id
      LEFT JOIN transactions t ON t.client_id = c.id
      WHERE ${fallbackCompanyClause}
      GROUP BY c.id, c.name, co.name
      ORDER BY
        COALESCE(SUM(ABS(t.amount::numeric)) FILTER (WHERE t.match_status = 'unmatched'), 0) DESC
    `) as typeof rows;
  }

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
