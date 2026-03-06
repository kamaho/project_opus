import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, matches } from "@/lib/db/schema";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { eq, desc, sql } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const clientId = params!.clientId;
  await verifyClientOwnership(clientId, tenantId);

  const [aggregated, lastMatch] = await Promise.all([
    db.execute<{
      set_number: number;
      total_count: string;
      matched_count: string;
      total_amount: string;
    }>(sql`
      SELECT
        ${transactions.setNumber} AS set_number,
        COUNT(*)::text AS total_count,
        COUNT(*) FILTER (WHERE ${transactions.matchStatus} = 'matched')::text AS matched_count,
        COALESCE(SUM(${transactions.amount}::numeric), 0)::text AS total_amount
      FROM ${transactions}
      WHERE ${transactions.clientId} = ${clientId}
      GROUP BY ${transactions.setNumber}
      ORDER BY ${transactions.setNumber}
    `),
    db
      .select({ matchedAt: matches.matchedAt })
      .from(matches)
      .where(eq(matches.clientId, clientId))
      .orderBy(desc(matches.matchedAt))
      .limit(1),
  ]);

  const breakdown = [1, 2].map((setNum) => {
    const row = [...aggregated].find((r) => Number(r.set_number) === setNum);
    return {
      setNumber: setNum,
      totalTransactions: parseInt(row?.total_count ?? "0", 10),
      matchedTransactions: parseInt(row?.matched_count ?? "0", 10),
      totalAmount: parseFloat(row?.total_amount ?? "0"),
    };
  });

  const totalAll = breakdown.reduce((s, b) => s + b.totalTransactions, 0);
  const matchedAll = breakdown.reduce((s, b) => s + b.matchedTransactions, 0);
  const pct = totalAll > 0 ? Math.round((matchedAll / totalAll) * 1000) / 10 : 0;

  return NextResponse.json({
    matchPercentage: pct,
    totalTransactions: totalAll,
    matchedTransactions: matchedAll,
    unmatchedTransactions: totalAll - matchedAll,
    lastReconciliation: lastMatch[0]?.matchedAt?.toISOString() ?? null,
    breakdown,
  });
});
