import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, imports, matches } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const clientId = params!.clientId;
  await verifyClientOwnership(clientId, tenantId);

  const [matchedTxRows, matchRows] = await Promise.all([
    db
      .select({
        id: transactions.id,
        setNumber: transactions.setNumber,
        date1: transactions.date1,
        amount: transactions.amount,
        bilag: transactions.bilag,
        reference: transactions.reference,
        description: transactions.description,
        matchId: transactions.matchId,
      })
      .from(transactions)
      .leftJoin(imports, eq(transactions.importId, imports.id))
      .where(
        and(
          eq(transactions.clientId, clientId),
          eq(transactions.matchStatus, "matched"),
          sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
        )
      ),
    db
      .select({
        id: matches.id,
        matchedAt: matches.matchedAt,
        matchedBy: matches.matchedBy,
        difference: matches.difference,
      })
      .from(matches)
      .where(eq(matches.clientId, clientId))
      .orderBy(sql`${matches.matchedAt} DESC`),
  ]);

  const txByMatchId = new Map<string, Array<{
    id: string;
    setNumber: number;
    date: string;
    amount: number;
    voucher?: string;
    text: string;
  }>>();

  for (const t of matchedTxRows) {
    if (!t.matchId) continue;
    const list = txByMatchId.get(t.matchId) ?? [];
    list.push({
      id: t.id,
      setNumber: t.setNumber,
      date: String(t.date1 ?? ""),
      amount: parseFloat(t.amount ?? "0"),
      voucher: t.bilag ?? t.reference ?? undefined,
      text: t.description ?? "",
    });
    txByMatchId.set(t.matchId, list);
  }

  const groups = matchRows
    .filter((m) => txByMatchId.has(m.id))
    .map((m) => ({
      matchId: m.id,
      matchedAt: m.matchedAt?.toISOString() ?? new Date().toISOString(),
      matchedBy: m.matchedBy,
      difference: parseFloat(m.difference ?? "0"),
      transactions: txByMatchId.get(m.id) ?? [],
    }));

  return NextResponse.json(groups);
});
