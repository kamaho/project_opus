import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { clients, companies, accounts, transactions } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AccountsTable } from "./accounts-table";
import { CreateReconciliationDialog } from "@/components/setup/create-reconciliation-dialog";

export default async function ClientsPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Avstemminger</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium">Opprett en organisasjon</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            For å se og opprette avstemminger trenger du en organisasjon.
            Bruk organisasjonsvelgeren øverst til venstre for å opprette en ny.
          </p>
        </div>
      </div>
    );
  }

  const list = await db
    .select({
      id: clients.id,
      name: clients.name,
      status: clients.status,
      companyName: companies.name,
      set1AccountNumber: accounts.accountNumber,
      set1AccountName: accounts.name,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .innerJoin(accounts, eq(clients.set1AccountId, accounts.id))
    .where(eq(companies.tenantId, orgId));

  const clientIds = list.map((c) => c.id);
  if (clientIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Avstemminger</h1>
          <CreateReconciliationDialog />
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium">Ingen avstemminger ennå</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Opprett din første avstemming for å begynne med matching av
            transaksjoner mellom hovedbok og bank.
          </p>
          <div className="mt-6">
            <CreateReconciliationDialog />
          </div>
        </div>
      </div>
    );
  }

  const unmatchedCounts = await db
    .select({
      clientId: transactions.clientId,
      setNumber: transactions.setNumber,
      count: sql<number>`count(*)::int`,
      sum: sql<string>`coalesce(sum(${transactions.amount})::text, '0')`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.clientId, clientIds),
        eq(transactions.matchStatus, "unmatched")
      )
    )
    .groupBy(transactions.clientId, transactions.setNumber);

  const byClient = new Map<
    string,
    { openSet1: number; openSet2: number; leftBalance: number; rightBalance: number }
  >();
  for (const c of list) {
    byClient.set(c.id, { openSet1: 0, openSet2: 0, leftBalance: 0, rightBalance: 0 });
  }
  for (const r of unmatchedCounts) {
    const cur = byClient.get(r.clientId);
    if (!cur) continue;
    const cnt = Number(r.count) ?? 0;
    const sum = parseFloat(r.sum ?? "0");
    if (r.setNumber === 1) {
      cur.openSet1 = cnt;
      cur.leftBalance = sum;
    } else {
      cur.openSet2 = cnt;
      cur.rightBalance = sum;
    }
  }

  const rows = list.map((c) => {
    const agg = byClient.get(c.id)!;
    return {
      id: c.id,
      matchGroup: c.name,
      company: c.companyName,
      ledgerAccountGroup: c.set1AccountNumber
        ? c.set1AccountNumber.slice(0, 2) + "xx"
        : "—",
      openItems: agg.openSet1 + agg.openSet2,
      leftBalance: agg.leftBalance,
      rightBalance: agg.rightBalance,
      hasDoc: false,
      lastTrans: null as string | null,
      lastRecon: null as string | null,
    };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Avstemminger</h1>
      <div className="flex flex-wrap items-center gap-2">
        <CreateReconciliationDialog />
      </div>
      <AccountsTable rows={rows} />
      <p className="text-muted-foreground text-sm">
        {rows.length} {rows.length === 1 ? "avstemming" : "avstemminger"} totalt
      </p>
    </div>
  );
}
