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

  const clientRows = await db
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
    );

  const sections: GroupMatchingClientSection[] = [];

  for (const cr of clientRows) {
    const [set1Acc, set2Acc] = await Promise.all([
      db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, cr.set1AccountId))
        .then((r) => r[0]),
      db
        .select({ name: accounts.name })
        .from(accounts)
        .where(eq(accounts.id, cr.set2AccountId))
        .then((r) => r[0]),
    ]);

    const set1Label = set1Acc?.name ?? "Mengde 1";
    const set2Label = set2Acc?.name ?? "Mengde 2";

    const queryOpenTx = async (setNum: 1 | 2) => {
      const rows = await db
        .select({
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
            eq(transactions.clientId, cr.id),
            eq(transactions.setNumber, setNum),
            eq(transactions.matchStatus, "unmatched"),
            sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
          )
        )
        .orderBy(transactions.date1);

      return rows.map(
        (r): MatchingTransactionExport => ({
          dato: String(r.date1 ?? ""),
          bilag: r.bilag ?? r.reference ?? "",
          beskrivelse: r.description ?? "",
          belop: parseFloat(r.amount ?? "0"),
        })
      );
    };

    const querySaldo = async (setNum: 1 | 2) => {
      const [row] = await db
        .select({
          total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
          cnt: count(),
        })
        .from(transactions)
        .leftJoin(imports, eq(transactions.importId, imports.id))
        .where(
          and(
            eq(transactions.clientId, cr.id),
            eq(transactions.setNumber, setNum),
            sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
          )
        );
      return { saldo: parseFloat(row?.total ?? "0"), poster: Number(row?.cnt ?? 0) };
    };

    const [aapneSet1, aapneSet2, saldo1, saldo2] = await Promise.all([
      queryOpenTx(1),
      queryOpenTx(2),
      querySaldo(1),
      querySaldo(2),
    ]);

    const [matchCountRow] = await db
      .select({ cnt: count() })
      .from(matches)
      .where(eq(matches.clientId, cr.id));
    const matchCountVal = Number(matchCountRow?.cnt ?? 0);

    const totalPoster = saldo1.poster + saldo2.poster;
    const matchProsent =
      totalPoster > 0
        ? Math.round(
            ((totalPoster - aapneSet1.length - aapneSet2.length) / totalPoster) * 100
          )
        : 0;

    sections.push({
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
    });
  }

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
