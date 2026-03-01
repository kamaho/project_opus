import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, matches } from "@/lib/db/schema";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { eq, and, count, sql, desc } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const clientId = params!.clientId;
  await verifyClientOwnership(clientId, tenantId);

  const [set1Count] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.clientId, clientId), eq(transactions.setNumber, 1)));

  const [set2Count] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.clientId, clientId), eq(transactions.setNumber, 2)));

  const [matchedCount] = await db
    .select({ total: count() })
    .from(transactions)
    .where(
      and(eq(transactions.clientId, clientId), eq(transactions.matchStatus, "matched"))
    );

  const [unmatchedCount] = await db
    .select({ total: count() })
    .from(transactions)
    .where(
      and(eq(transactions.clientId, clientId), eq(transactions.matchStatus, "unmatched"))
    );

  const [diffResult] = await db
    .select({
      diff: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.matchStatus} = 'unmatched' THEN ${transactions.amount}::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.clientId, clientId));

  const [lastMatch] = await db
    .select({ matchedAt: matches.matchedAt })
    .from(matches)
    .where(eq(matches.clientId, clientId))
    .orderBy(desc(matches.matchedAt))
    .limit(1);

  const totalTx = (set1Count?.total ?? 0) + (set2Count?.total ?? 0);
  const matched = matchedCount?.total ?? 0;
  const matchPct = totalTx > 0 ? Math.round((matched / totalTx) * 1000) / 10 : 0;

  return NextResponse.json({
    transactionsSet1: set1Count?.total ?? 0,
    transactionsSet2: set2Count?.total ?? 0,
    matchedCount: matched,
    unmatchedCount: unmatchedCount?.total ?? 0,
    matchPercentage: matchPct,
    totalDifference: parseFloat((diffResult?.diff as string) ?? "0"),
    lastReconciliation: lastMatch?.matchedAt?.toISOString() ?? null,
  });
});
