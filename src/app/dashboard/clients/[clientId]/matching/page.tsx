import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { transactions, imports, matches, clients, transactionAttachments } from "@/lib/db/schema";
import { eq, and, sql, exists } from "drizzle-orm";
import { MatchingViewClient } from "@/components/matching/matching-view-client";
import type { TransactionRow } from "@/components/matching/transaction-panel";
import type { MatchGroup, MatchGroupTransaction } from "@/components/matching/matched-groups-view";
import { validateClientTenant } from "@/lib/db/tenant";
import { getCachedAccount } from "@/lib/cache";

export default async function MatchingPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { orgId } = await auth();
  const { clientId } = await params;
  if (!orgId) notFound();

  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) notFound();

  const [set1Account, set2Account, clientData] = await Promise.all([
    getCachedAccount(clientRow.set1AccountId, orgId),
    getCachedAccount(clientRow.set2AccountId, orgId),
    db
      .select({
        openingBalanceSet1: clients.openingBalanceSet1,
        openingBalanceSet2: clients.openingBalanceSet2,
        openingBalanceDate: clients.openingBalanceDate,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .then((rows) => rows[0]),
  ]);

  const set1Label = set1Account?.name ?? "Mengde 1";
  const set2Label = set2Account?.name ?? "Mengde 2";

  const hasAttachmentSubquery = exists(
    db
      .select({ one: sql`1` })
      .from(transactionAttachments)
      .where(eq(transactionAttachments.transactionId, transactions.id))
  );

  const unmatchedQuery = (setNum: 1 | 2) =>
    db
      .select({
        id: transactions.id,
        date1: transactions.date1,
        amount: transactions.amount,
        reference: transactions.reference,
        bilag: transactions.bilag,
        description: transactions.description,
        notat: transactions.notat,
        notatAuthor: transactions.notatAuthor,
        hasAttachment: hasAttachmentSubquery,
      })
      .from(transactions)
      .leftJoin(imports, eq(transactions.importId, imports.id))
      .where(
        and(
          eq(transactions.clientId, clientId),
          eq(transactions.setNumber, setNum),
          sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`,
          eq(transactions.matchStatus, "unmatched")
        )
      )
      .orderBy(transactions.date1);

  const matchedTxQuery = db
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
    );

  const matchesQuery = db
    .select({
      id: matches.id,
      matchedAt: matches.matchedAt,
      matchedBy: matches.matchedBy,
      difference: matches.difference,
    })
    .from(matches)
    .where(eq(matches.clientId, clientId))
    .orderBy(sql`${matches.matchedAt} DESC`);

  const [txSet1, txSet2, matchedTxRows, matchRows] = await Promise.all([
    unmatchedQuery(1),
    unmatchedQuery(2),
    matchedTxQuery,
    matchesQuery,
  ]);

  const toRow = (t: {
    id: string;
    date1: Date | string;
    amount: string | null;
    reference: string | null;
    bilag: string | null;
    description: string | null;
    notat?: string | null;
    notatAuthor?: string | null;
    hasAttachment?: boolean;
  }): TransactionRow => ({
    id: t.id,
    date: typeof t.date1 === "string" ? t.date1 : t.date1?.toISOString().slice(0, 10) ?? "",
    amount: parseFloat(t.amount ?? "0"),
    voucher: t.bilag ?? t.reference ?? undefined,
    text: t.description ?? "",
    notat: t.notat ?? null,
    notatAuthor: t.notatAuthor ?? null,
    hasAttachment: t.hasAttachment ?? false,
  });

  const rows1: TransactionRow[] = txSet1.map(toRow);
  const rows2: TransactionRow[] = txSet2.map(toRow);

  const balance1 = rows1.reduce((s, r) => s + r.amount, 0);
  const balance2 = rows2.reduce((s, r) => s + r.amount, 0);

  // Build matched groups
  const txByMatchId = new Map<string, MatchGroupTransaction[]>();
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

  const matchedGroups: MatchGroup[] = matchRows
    .filter((m) => txByMatchId.has(m.id))
    .map((m) => ({
      matchId: m.id,
      matchedAt: m.matchedAt?.toISOString() ?? new Date().toISOString(),
      matchedBy: m.matchedBy,
      difference: parseFloat(m.difference ?? "0"),
      transactions: txByMatchId.get(m.id) ?? [],
    }));

  return (
    <Suspense>
      <MatchingViewClient
        clientId={clientId}
        clientName={clientRow.name}
        set1Label={set1Label}
        set2Label={set2Label}
        rows1={rows1}
        rows2={rows2}
        balance1={balance1}
        balance2={balance2}
        matchedGroups={matchedGroups}
        openingBalanceSet1={clientData?.openingBalanceSet1 ?? "0"}
        openingBalanceSet2={clientData?.openingBalanceSet2 ?? "0"}
        openingBalanceDate={clientData?.openingBalanceDate ?? null}
      />
    </Suspense>
  );
}
