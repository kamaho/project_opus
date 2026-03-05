import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, matches } from "@/lib/db/schema";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { eq, and, count, sql, desc } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const clientId = params!.clientId;
  await verifyClientOwnership(clientId, tenantId);

  let s1 = 0, s2 = 0, matchedN = 0, unmatchedN = 0, diff = 0;

  try {
    const mvRows = await db.execute(sql`
      SELECT set1_count, set2_count, matched_count, unmatched_count, unmatched_total
      FROM client_stats_mv
      WHERE tenant_id = ${tenantId} AND client_id = ${clientId}
      LIMIT 1
    `);
    const mv = (Array.from(mvRows) as { set1_count: string; set2_count: string; matched_count: string; unmatched_count: string; unmatched_total: string }[])[0];
    if (mv) {
      s1 = Number(mv.set1_count);
      s2 = Number(mv.set2_count);
      matchedN = Number(mv.matched_count);
      unmatchedN = Number(mv.unmatched_count);
      diff = parseFloat(String(mv.unmatched_total));
    }
  } catch {
    const [
      [set1Count],
      [set2Count],
      [matchedCount],
      [unmatchedCount],
      [diffResult],
    ] = await Promise.all([
      db
        .select({ total: count() })
        .from(transactions)
        .where(and(eq(transactions.clientId, clientId), eq(transactions.setNumber, 1))),
      db
        .select({ total: count() })
        .from(transactions)
        .where(and(eq(transactions.clientId, clientId), eq(transactions.setNumber, 2))),
      db
        .select({ total: count() })
        .from(transactions)
        .where(and(eq(transactions.clientId, clientId), eq(transactions.matchStatus, "matched"))),
      db
        .select({ total: count() })
        .from(transactions)
        .where(and(eq(transactions.clientId, clientId), eq(transactions.matchStatus, "unmatched"))),
      db
        .select({
          diff: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.matchStatus} = 'unmatched' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(transactions)
        .where(eq(transactions.clientId, clientId)),
    ]);
    s1 = set1Count?.total ?? 0;
    s2 = set2Count?.total ?? 0;
    matchedN = matchedCount?.total ?? 0;
    unmatchedN = unmatchedCount?.total ?? 0;
    diff = parseFloat((diffResult?.diff as string) ?? "0");
  }

  const [lastMatch] = await db
    .select({ matchedAt: matches.matchedAt })
    .from(matches)
    .where(eq(matches.clientId, clientId))
    .orderBy(desc(matches.matchedAt))
    .limit(1);

  const totalTx = s1 + s2;
  const matchPct = totalTx > 0 ? Math.round((matchedN / totalTx) * 1000) / 10 : 0;

  return NextResponse.json({
    transactionsSet1: s1,
    transactionsSet2: s2,
    matchedCount: matchedN,
    unmatchedCount: unmatchedN,
    matchPercentage: matchPct,
    totalDifference: diff,
    lastReconciliation: lastMatch?.matchedAt?.toISOString() ?? null,
  });
});
