import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, matches } from "@/lib/db/schema";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { eq, and, count, desc, sql } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const clientId = params!.clientId;
  await verifyClientOwnership(clientId, tenantId);

  const sets = [1, 2] as const;
  const breakdown = await Promise.all(
    sets.map(async (setNum) => {
      const [total] = await db
        .select({ n: count() })
        .from(transactions)
        .where(
          and(eq(transactions.clientId, clientId), eq(transactions.setNumber, setNum))
        );

      const [matched] = await db
        .select({ n: count() })
        .from(transactions)
        .where(
          and(
            eq(transactions.clientId, clientId),
            eq(transactions.setNumber, setNum),
            eq(transactions.matchStatus, "matched")
          )
        );

      const [sumResult] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
        })
        .from(transactions)
        .where(
          and(eq(transactions.clientId, clientId), eq(transactions.setNumber, setNum))
        );

      return {
        setNumber: setNum,
        totalTransactions: total?.n ?? 0,
        matchedTransactions: matched?.n ?? 0,
        totalAmount: parseFloat((sumResult?.total as string) ?? "0"),
      };
    })
  );

  const [lastMatch] = await db
    .select({ matchedAt: matches.matchedAt })
    .from(matches)
    .where(eq(matches.clientId, clientId))
    .orderBy(desc(matches.matchedAt))
    .limit(1);

  const totalAll = breakdown.reduce((s, b) => s + b.totalTransactions, 0);
  const matchedAll = breakdown.reduce((s, b) => s + b.matchedTransactions, 0);
  const pct = totalAll > 0 ? Math.round((matchedAll / totalAll) * 1000) / 10 : 0;

  return NextResponse.json({
    matchPercentage: pct,
    totalTransactions: totalAll,
    matchedTransactions: matchedAll,
    unmatchedTransactions: totalAll - matchedAll,
    lastReconciliation: lastMatch?.matchedAt?.toISOString() ?? null,
    breakdown,
  });
});
