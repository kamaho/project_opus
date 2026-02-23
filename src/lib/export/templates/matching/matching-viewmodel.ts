import { db } from "@/lib/db";
import {
  transactions,
  matches,
  imports,
  clients,
  companies,
  accounts,
} from "@/lib/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import type {
  MatchingExportPayload,
  MatchingExportViewModel,
  MatchingTransactionExport,
  MatchingMatchGroupExport,
  ExportContext,
} from "../../types";

export async function buildMatchingViewModel(
  payload: MatchingExportPayload,
  context: ExportContext
): Promise<MatchingExportViewModel> {
  const { clientId, reportType, dateFrom, dateTo } = payload;

  const clientRow = await db
    .select({
      id: clients.id,
      name: clients.name,
      companyId: clients.companyId,
      set1AccountId: clients.set1AccountId,
      set2AccountId: clients.set2AccountId,
      companyName: companies.name,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(
      and(eq(clients.id, clientId), eq(companies.tenantId, context.tenantId))
    )
    .then((rows) => rows[0]);

  if (!clientRow) {
    throw new Error("Klient ikke funnet eller manglende tilgang");
  }

  const companyName = clientRow.companyName ?? undefined;
  const generatedBy = context.userEmail ?? undefined;

  const [set1Acc, set2Acc] = await Promise.all([
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, clientRow.set1AccountId))
      .then((r) => r[0]),
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, clientRow.set2AccountId))
      .then((r) => r[0]),
  ]);

  const set1Label = set1Acc?.name ?? "Mengde 1";
  const set2Label = set2Acc?.name ?? "Mengde 2";

  const datoPeriode = buildDateLabel(dateFrom, dateTo);
  const now = new Date().toISOString();

  if (reportType === "open") {
    return buildOpenReport(
      clientId,
      clientRow.name,
      set1Label,
      set2Label,
      datoPeriode,
      dateFrom,
      dateTo,
      now,
      companyName,
      generatedBy
    );
  }

  return buildClosedReport(
    clientId,
    clientRow.name,
    set1Label,
    set2Label,
    datoPeriode,
    dateFrom,
    dateTo,
    now,
    companyName,
    generatedBy
  );
}

// ── Open report ────────────────────────────────────────────────────

async function buildOpenReport(
  clientId: string,
  klientNavn: string,
  set1Label: string,
  set2Label: string,
  datoPeriode: string,
  dateFrom?: string,
  dateTo?: string,
  genererTidspunkt?: string,
  companyName?: string,
  generatedBy?: string
): Promise<MatchingExportViewModel> {
  const querySet = async (setNum: 1 | 2) => {
    const conditions = [
      eq(transactions.clientId, clientId),
      eq(transactions.setNumber, setNum),
      eq(transactions.matchStatus, "unmatched"),
      sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`,
    ];
    if (dateFrom) conditions.push(gte(transactions.date1, dateFrom));
    if (dateTo) conditions.push(lte(transactions.date1, dateTo));

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
      .where(and(...conditions))
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

  const [aapneSet1, aapneSet2] = await Promise.all([
    querySet(1),
    querySet(2),
  ]);

  return {
    klientNavn,
    set1Label,
    set2Label,
    reportType: "open",
    datoPeriode,
    aapneSet1,
    aapneSet2,
    antallSet1: aapneSet1.length,
    antallSet2: aapneSet2.length,
    totalSet1: aapneSet1.reduce((s, t) => s + t.belop, 0),
    totalSet2: aapneSet2.reduce((s, t) => s + t.belop, 0),
    genererTidspunkt: genererTidspunkt ?? new Date().toISOString(),
    companyName,
    generatedBy,
  };
}

// ── Closed report ──────────────────────────────────────────────────

async function buildClosedReport(
  clientId: string,
  klientNavn: string,
  set1Label: string,
  set2Label: string,
  datoPeriode: string,
  dateFrom?: string,
  dateTo?: string,
  genererTidspunkt?: string,
  companyName?: string,
  generatedBy?: string
): Promise<MatchingExportViewModel> {
  const matchConditions = [eq(matches.clientId, clientId)];
  if (dateFrom) matchConditions.push(gte(matches.matchedAt, new Date(dateFrom)));
  if (dateTo) matchConditions.push(lte(matches.matchedAt, new Date(dateTo)));

  const matchRows = await db
    .select({
      id: matches.id,
      matchedAt: matches.matchedAt,
      matchType: matches.matchType,
      difference: matches.difference,
    })
    .from(matches)
    .where(and(...matchConditions))
    .orderBy(sql`${matches.matchedAt} DESC`);

  const matchIds = matchRows.map((m) => m.id);

  interface TxWithSet extends MatchingTransactionExport {
    setNumber: number;
  }

  const txByMatchId = new Map<string, TxWithSet[]>();

  if (matchIds.length > 0) {
    const txRows = await db
      .select({
        matchId: transactions.matchId,
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
          eq(transactions.clientId, clientId),
          eq(transactions.matchStatus, "matched"),
          sql`${transactions.matchId} = ANY(${matchIds})`,
          sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
        )
      );

    for (const t of txRows) {
      if (!t.matchId) continue;
      const list = txByMatchId.get(t.matchId) ?? [];
      list.push({
        setNumber: t.setNumber,
        dato: String(t.date1 ?? ""),
        bilag: t.bilag ?? t.reference ?? "",
        beskrivelse: t.description ?? "",
        belop: parseFloat(t.amount ?? "0"),
      });
      txByMatchId.set(t.matchId, list);
    }
  }

  const matcherExport: MatchingMatchGroupExport[] = matchRows.map((m) => {
    const txs = txByMatchId.get(m.id) ?? [];
    return {
      matchDato: m.matchedAt?.toISOString().slice(0, 10) ?? "",
      type: m.matchType,
      differanse: parseFloat(m.difference ?? "0"),
      transaksjonerSet1: txs
        .filter((t) => t.setNumber === 1)
        .map((t) => ({ dato: t.dato, bilag: t.bilag, beskrivelse: t.beskrivelse, belop: t.belop })),
      transaksjonerSet2: txs
        .filter((t) => t.setNumber === 2)
        .map((t) => ({ dato: t.dato, bilag: t.bilag, beskrivelse: t.beskrivelse, belop: t.belop })),
    };
  });

  const totalMatchet = matcherExport.reduce((s, m) => {
    const set1Sum = m.transaksjonerSet1.reduce((a, t) => a + Math.abs(t.belop), 0);
    return s + set1Sum;
  }, 0);

  return {
    klientNavn,
    set1Label,
    set2Label,
    reportType: "closed",
    datoPeriode,
    matcher: matcherExport,
    antallMatcher: matcherExport.length,
    totalMatchet,
    genererTidspunkt: genererTidspunkt ?? new Date().toISOString(),
    companyName,
    generatedBy,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function buildDateLabel(from?: string, to?: string): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `Fra ${from}`;
  if (to) return `Til ${to}`;
  return "Alle datoer";
}
