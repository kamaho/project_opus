import { db } from "@/lib/db";
import {
  transactions,
  matches,
  imports,
  clients,
  companies,
  accounts,
} from "@/lib/db/schema";
import { eq, and, sql, count, inArray } from "drizzle-orm";
import type {
  GroupMatchingExportPayload,
  GroupMatchingExportViewModel,
  GroupMatchingClientSection,
  MatchingTransactionExport,
  ExportContext,
} from "../../types";

export async function buildGroupMatchingViewModel(
  payload: GroupMatchingExportPayload,
  context: ExportContext
): Promise<GroupMatchingExportViewModel> {
  const { groupName, clientIds } = payload;

  if (clientIds.length === 0) {
    return {
      groupName,
      clientCount: 0,
      sections: [],
      totals: { totalOpenSet1: 0, totalOpenSet2: 0, totalSaldoSet1: 0, totalSaldoSet2: 0, totalMatches: 0 },
      genererTidspunkt: new Date().toISOString(),
      generatedBy: context.userEmail ?? undefined,
    };
  }

  const [clientRows, accountRows, openTxRows, saldoRows, matchCountRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        set1AccountId: clients.set1AccountId,
        set2AccountId: clients.set2AccountId,
        companyName: companies.name,
      })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(
        and(
          eq(companies.tenantId, context.tenantId),
          inArray(clients.id, clientIds)
        )
      ),
    db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(
        inArray(
          accounts.id,
          db
            .select({ id: clients.set1AccountId })
            .from(clients)
            .where(inArray(clients.id, clientIds))
            .union(
              db
                .select({ id: clients.set2AccountId })
                .from(clients)
                .where(inArray(clients.id, clientIds))
            )
        )
      ),
    db
      .select({
        clientId: transactions.clientId,
        setNumber: transactions.setNumber,
        date1: transactions.date1,
        amount: transactions.amount,
        bilag: transactions.bilag,
        reference: transactions.reference,
        description: transactions.description,
      })
      .from(transactions)
      .leftJoin(imports, eq(transactions.importId, imports.id))
      .where(
        and(
          inArray(transactions.clientId, clientIds),
          eq(transactions.matchStatus, "unmatched"),
          sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
        )
      )
      .orderBy(transactions.date1),
    db
      .select({
        clientId: transactions.clientId,
        setNumber: transactions.setNumber,
        total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
        cnt: count(),
      })
      .from(transactions)
      .leftJoin(imports, eq(transactions.importId, imports.id))
      .where(
        and(
          inArray(transactions.clientId, clientIds),
          sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
        )
      )
      .groupBy(transactions.clientId, transactions.setNumber),
    db
      .select({
        clientId: matches.clientId,
        cnt: count(),
      })
      .from(matches)
      .where(inArray(matches.clientId, clientIds))
      .groupBy(matches.clientId),
  ]);

  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]));

  const openTxByClient = new Map<string, Map<number, MatchingTransactionExport[]>>();
  for (const r of openTxRows) {
    if (!openTxByClient.has(r.clientId)) openTxByClient.set(r.clientId, new Map());
    const bySet = openTxByClient.get(r.clientId)!;
    if (!bySet.has(r.setNumber)) bySet.set(r.setNumber, []);
    bySet.get(r.setNumber)!.push({
      dato: String(r.date1 ?? ""),
      bilag: r.bilag ?? r.reference ?? "",
      beskrivelse: r.description ?? "",
      belop: parseFloat(r.amount ?? "0"),
    });
  }

  const saldoByClient = new Map<string, Map<number, { saldo: number; poster: number }>>();
  for (const r of saldoRows) {
    if (!saldoByClient.has(r.clientId)) saldoByClient.set(r.clientId, new Map());
    saldoByClient.get(r.clientId)!.set(r.setNumber, {
      saldo: parseFloat(r.total),
      poster: Number(r.cnt),
    });
  }

  const matchCountByClient = new Map(matchCountRows.map((r) => [r.clientId, Number(r.cnt)]));

  const sections: GroupMatchingClientSection[] = clientRows.map((cr) => {
    const set1Label = accountMap.get(cr.set1AccountId) ?? "Mengde 1";
    const set2Label = accountMap.get(cr.set2AccountId) ?? "Mengde 2";

    const aapneSet1 = openTxByClient.get(cr.id)?.get(1) ?? [];
    const aapneSet2 = openTxByClient.get(cr.id)?.get(2) ?? [];

    const saldo1 = saldoByClient.get(cr.id)?.get(1) ?? { saldo: 0, poster: 0 };
    const saldo2 = saldoByClient.get(cr.id)?.get(2) ?? { saldo: 0, poster: 0 };

    const matchCountVal = matchCountByClient.get(cr.id) ?? 0;
    const totalPoster = saldo1.poster + saldo2.poster;
    const matchProsent =
      totalPoster > 0
        ? Math.round(((totalPoster - aapneSet1.length - aapneSet2.length) / totalPoster) * 100)
        : 0;

    return {
      klientNavn: cr.name,
      companyName: cr.companyName ?? undefined,
      set1Label,
      set2Label,
      aapneSet1,
      aapneSet2,
      totalSet1: aapneSet1.reduce((s, t) => s + t.belop, 0),
      totalSet2: aapneSet2.reduce((s, t) => s + t.belop, 0),
      saldoSet1: saldo1.saldo,
      saldoSet2: saldo2.saldo,
      matchCount: matchCountVal,
      matchProsent,
    };
  });

  return {
    groupName,
    clientCount: sections.length,
    sections,
    totals: {
      totalOpenSet1: sections.reduce((s, sec) => s + sec.aapneSet1.length, 0),
      totalOpenSet2: sections.reduce((s, sec) => s + sec.aapneSet2.length, 0),
      totalSaldoSet1: sections.reduce((s, sec) => s + sec.saldoSet1, 0),
      totalSaldoSet2: sections.reduce((s, sec) => s + sec.saldoSet2, 0),
      totalMatches: sections.reduce((s, sec) => s + sec.matchCount, 0),
    },
    genererTidspunkt: new Date().toISOString(),
    generatedBy: context.userEmail ?? undefined,
  };
}
