import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { clients, companies, accounts, transactions } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { AccountsTable } from "./accounts-table";

export default async function ClientsPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Kontoer</h1>
        <p className="text-muted-foreground">Velg en organisasjon for å se kontoer.</p>
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
        <h1 className="text-2xl font-semibold">Kontoer</h1>
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2 max-w-xl">
          <p className="text-muted-foreground">Ingen kontoer for denne organisasjonen.</p>
          <p className="text-sm text-muted-foreground">
            For demo-data: <code className="rounded bg-muted px-1">SEED_TENANT_ID={orgId} npm run seed</code>
          </p>
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

  const byClient = new Map<string, { openSet1: number; openSet2: number; leftBalance: number; rightBalance: number }>();
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
      ledgerAccountGroup: c.set1AccountNumber ? c.set1AccountNumber.slice(0, 2) + "xx" : "—",
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Kontoer</h1>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Avstemming nødvendig</span>
          <input type="checkbox" className="rounded border" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          Oppdater
        </button>
        <button
          type="button"
          className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          Visning
        </button>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">Filter</span>
          <button type="button" className="font-medium">
            Selskap
          </button>
          <span className="text-muted-foreground">er Alle</span>
          <button type="button" className="text-muted-foreground hover:text-foreground">
            Tøm
          </button>
        </div>
      </div>
      <AccountsTable rows={rows} />
      <p className="text-muted-foreground text-sm">{rows.length} kontoer totalt</p>
    </div>
  );
}
