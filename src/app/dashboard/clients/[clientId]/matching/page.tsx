import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { transactions, imports } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { MatchingViewClient } from "@/components/matching/matching-view-client";
import type { TransactionRow } from "@/components/matching/transaction-panel";
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

  const [set1Account, set2Account] = await Promise.all([
    getCachedAccount(clientRow.set1AccountId, orgId),
    getCachedAccount(clientRow.set2AccountId, orgId),
  ]);

  const set1Label = set1Account?.name ?? "Mengde 1";
  const set2Label = set2Account?.name ?? "Mengde 2";

  const activeTransactionQuery = (setNum: 1 | 2) =>
    db
      .select({
        id: transactions.id,
        date1: transactions.date1,
        amount: transactions.amount,
        reference: transactions.reference,
        bilag: transactions.bilag,
        description: transactions.description,
      })
      .from(transactions)
      .leftJoin(imports, eq(transactions.importId, imports.id))
      .where(
        and(
          eq(transactions.clientId, clientId),
          eq(transactions.setNumber, setNum),
          sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
        )
      )
      .orderBy(transactions.date1);

  const [txSet1, txSet2] = await Promise.all([
    activeTransactionQuery(1),
    activeTransactionQuery(2),
  ]);

  const toRow = (t: {
    id: string;
    date1: Date | string;
    amount: string | null;
    reference: string | null;
    bilag: string | null;
    description: string | null;
  }): TransactionRow => ({
    id: t.id,
    date: typeof t.date1 === "string" ? t.date1 : t.date1?.toISOString().slice(0, 10) ?? "",
    amount: parseFloat(t.amount ?? "0"),
    voucher: t.bilag ?? t.reference ?? undefined,
    text: t.description ?? "",
  });

  const rows1: TransactionRow[] = txSet1.map(toRow);
  const rows2: TransactionRow[] = txSet2.map(toRow);

  const balance1 = rows1.reduce((s, r) => s + r.amount, 0);
  const balance2 = rows2.reduce((s, r) => s + r.amount, 0);

  return (
    <MatchingViewClient
      clientId={clientId}
      clientName={clientRow.name}
      set1Label={set1Label}
      set2Label={set2Label}
      rows1={rows1}
      rows2={rows2}
      balance1={balance1}
      balance2={balance2}
    />
  );
}
