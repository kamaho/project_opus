import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, companies, transactions } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export const GET = withTenant(async (req, { tenantId }) => {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "ids parameter er påkrevd" }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length < 2) {
    return NextResponse.json({ error: "Minst 2 klient-IDer er påkrevd" }, { status: 400 });
  }

  const clientRows = await db
    .select({
      id: clients.id,
      name: clients.name,
      companyName: companies.name,
      openingBalanceSet1: clients.openingBalanceSet1,
      openingBalanceSet2: clients.openingBalanceSet2,
      openingBalanceDate: clients.openingBalanceDate,
      set1AccountNumber: sql<string>`s1.account_number`,
      set2AccountNumber: sql<string>`s2.account_number`,
      set1AccountName: sql<string>`s1.name`,
      set2AccountName: sql<string>`s2.name`,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .innerJoin(sql`accounts s1`, sql`s1.id = ${clients.set1AccountId}`)
    .innerJoin(sql`accounts s2`, sql`s2.id = ${clients.set2AccountId}`)
    .where(and(eq(companies.tenantId, tenantId), inArray(clients.id, ids)));

  if (clientRows.length < 2) {
    return NextResponse.json({ error: "Fant ikke nok klienter" }, { status: 404 });
  }

  const clientIds = clientRows.map((c) => c.id);

  const txnStats = await db
    .select({
      clientId: transactions.clientId,
      setNumber: transactions.setNumber,
      matchStatus: transactions.matchStatus,
      count: sql<number>`count(*)::int`,
      sum: sql<string>`coalesce(sum(${transactions.amount})::text, '0')`,
      lastDate: sql<string>`max(${transactions.date1})`,
    })
    .from(transactions)
    .where(inArray(transactions.clientId, clientIds))
    .groupBy(transactions.clientId, transactions.setNumber, transactions.matchStatus);

  type ClientStats = {
    totalSet1: number;
    totalSet2: number;
    unmatchedSet1: number;
    unmatchedSet2: number;
    unmatchedCountSet1: number;
    unmatchedCountSet2: number;
    lastTransDate: string | null;
  };

  const statsMap = new Map<string, ClientStats>();
  for (const c of clientRows) {
    statsMap.set(c.id, {
      totalSet1: 0, totalSet2: 0,
      unmatchedSet1: 0, unmatchedSet2: 0,
      unmatchedCountSet1: 0, unmatchedCountSet2: 0,
      lastTransDate: null,
    });
  }

  for (const row of txnStats) {
    const s = statsMap.get(row.clientId);
    if (!s) continue;
    const sum = parseFloat(row.sum ?? "0");
    if (row.setNumber === 1) {
      s.totalSet1 += sum;
      if (row.matchStatus === "unmatched") {
        s.unmatchedSet1 = sum;
        s.unmatchedCountSet1 = row.count;
      }
    } else {
      s.totalSet2 += sum;
      if (row.matchStatus === "unmatched") {
        s.unmatchedSet2 = sum;
        s.unmatchedCountSet2 = row.count;
      }
    }
    if (row.lastDate && (!s.lastTransDate || row.lastDate > s.lastTransDate)) {
      s.lastTransDate = row.lastDate;
    }
  }

  const result = clientRows.map((c) => {
    const s = statsMap.get(c.id)!;
    const ib1 = parseFloat(c.openingBalanceSet1 ?? "0");
    const ib2 = parseFloat(c.openingBalanceSet2 ?? "0");
    return {
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      set1AccountNumber: c.set1AccountNumber,
      set2AccountNumber: c.set2AccountNumber,
      set1AccountName: c.set1AccountName,
      set2AccountName: c.set2AccountName,
      openingBalanceSet1: ib1,
      openingBalanceSet2: ib2,
      openingBalanceDate: c.openingBalanceDate,
      balanceSet1: ib1 + s.totalSet1,
      balanceSet2: ib2 + s.totalSet2,
      unmatchedSumSet1: s.unmatchedSet1,
      unmatchedSumSet2: s.unmatchedSet2,
      unmatchedCountSet1: s.unmatchedCountSet1,
      unmatchedCountSet2: s.unmatchedCountSet2,
      lastTransDate: s.lastTransDate,
    };
  });

  const nettoSet1 = result.reduce((s, c) => s + c.balanceSet1, 0);
  const nettoSet2 = result.reduce((s, c) => s + c.balanceSet2, 0);
  const totalUnmatchedCount = result.reduce(
    (s, c) => s + c.unmatchedCountSet1 + c.unmatchedCountSet2,
    0
  );

  return NextResponse.json({
    clients: result,
    totals: {
      nettoSet1,
      nettoSet2,
      totalUnmatchedCount,
    },
  });
});
