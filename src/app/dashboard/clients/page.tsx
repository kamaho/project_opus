import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { clients, companies, accounts, transactions, clientGroups, clientGroupMembers, tripletexSyncConfigs, accountSyncSettings, tripletexConnections } from "@/lib/db/schema";
import { eq, and, sql, inArray, asc, desc } from "drizzle-orm";
import { ClientsPageClient } from "./clients-page-client";
import { CreateReconciliationDialog } from "@/components/setup/create-reconciliation-dialog";
import { SyncInProgressView } from "./sync-in-progress-view";

export default async function ClientsPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Klient avstemming</h1>
        <p className="text-muted-foreground">
          Velg en organisasjon for å se klienter.
        </p>
      </div>
    );
  }

  const list = await db
    .select({
      id: clients.id,
      status: clients.status,
      companyName: companies.name,
      set1AccountNumber: accounts.accountNumber,
      assignedUserId: clients.assignedUserId,
      txSyncActive: tripletexSyncConfigs.isActive,
      syncStatus: tripletexSyncConfigs.syncStatus,
      syncError: tripletexSyncConfigs.syncError,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .innerJoin(accounts, eq(clients.set1AccountId, accounts.id))
    .leftJoin(tripletexSyncConfigs, eq(tripletexSyncConfigs.clientId, clients.id))
    .where(eq(companies.tenantId, orgId));

  const clientIds = list.map((c) => c.id);

  // Fetch account_sync_settings for the company accounts view (needed even when no clients)
  const companyRows = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.tenantId, orgId));

  const companyIds = companyRows.map((c) => c.id);
  let accountSyncRows: {
    id: string;
    accountNumber: string;
    accountName: string;
    accountType: "ledger" | "bank";
    syncLevel: "balance_only" | "transactions";
    balanceIn: string | null;
    balanceOut: string | null;
    balanceYear: number | null;
    clientId: string | null;
    txCount: number;
    lastTxSyncAt: string | null;
    companyId: string;
  }[] = [];

  if (companyIds.length > 0) {
    const rawAcctRows = await db
      .select()
      .from(accountSyncSettings)
      .where(
        and(
          eq(accountSyncSettings.tenantId, orgId),
          inArray(accountSyncSettings.companyId, companyIds)
        )
      )
      .orderBy(
        desc(accountSyncSettings.syncLevel),
        asc(accountSyncSettings.accountNumber)
      );

    accountSyncRows = rawAcctRows.map((r) => ({
      id: r.id,
      accountNumber: r.accountNumber,
      accountName: r.accountName,
      accountType: r.accountType as "ledger" | "bank",
      syncLevel: r.syncLevel as "balance_only" | "transactions",
      balanceIn: r.balanceIn,
      balanceOut: r.balanceOut,
      balanceYear: r.balanceYear,
      clientId: r.clientId,
      txCount: r.txCount ?? 0,
      lastTxSyncAt: r.lastTxSyncAt?.toISOString() ?? null,
      companyId: r.companyId,
    }));
  }

  if (clientIds.length === 0 && accountSyncRows.length === 0) {
    // Check if there's an active Tripletex connection — sync may be in progress
    const [txConn] = await db
      .select({ id: tripletexConnections.id })
      .from(tripletexConnections)
      .where(and(eq(tripletexConnections.tenantId, orgId), eq(tripletexConnections.isActive, true)))
      .limit(1);

    if (txConn) {
      return <SyncInProgressView />;
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Klient avstemming</h1>
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
          <h3 className="text-lg font-medium">Ingen klienter ennå</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Opprett din første klient for å begynne med avstemming av
            transaksjoner mellom hovedbok og bank.
          </p>
          <div className="mt-6">
            <CreateReconciliationDialog />
          </div>
        </div>
      </div>
    );
  }

  const unmatchedCounts = clientIds.length > 0
    ? await db
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
        .groupBy(transactions.clientId, transactions.setNumber)
    : [];

  // Total balance per client/set (ALL transactions, not just unmatched)
  const totalBalances = clientIds.length > 0
    ? await db
        .select({
          clientId: transactions.clientId,
          setNumber: transactions.setNumber,
          sum: sql<string>`coalesce(sum(${transactions.amount})::text, '0')`,
        })
        .from(transactions)
        .where(inArray(transactions.clientId, clientIds))
        .groupBy(transactions.clientId, transactions.setNumber)
    : [];

  // IB lookup: accountNumber -> balanceIn (integration-agnostic)
  const ibByAccount = new Map<string, number>();
  for (const r of accountSyncRows) {
    if (r.balanceIn) {
      ibByAccount.set(r.accountNumber, parseFloat(r.balanceIn));
    }
  }

  const byClient = new Map<
    string,
    { openSet1: number; openSet2: number; leftBalance: number; rightBalance: number }
  >();
  for (const c of list) {
    const ib = ibByAccount.get(c.set1AccountNumber ?? "") ?? 0;
    byClient.set(c.id, { openSet1: 0, openSet2: 0, leftBalance: ib, rightBalance: 0 });
  }
  for (const r of unmatchedCounts) {
    const cur = byClient.get(r.clientId);
    if (!cur) continue;
    if (r.setNumber === 1) {
      cur.openSet1 = Number(r.count) ?? 0;
    } else {
      cur.openSet2 = Number(r.count) ?? 0;
    }
  }
  for (const r of totalBalances) {
    const cur = byClient.get(r.clientId);
    if (!cur) continue;
    const sum = parseFloat(r.sum ?? "0");
    if (r.setNumber === 1) {
      cur.leftBalance += sum;
    } else {
      cur.rightBalance += sum;
    }
  }

  const rows = list.map((c) => {
    const agg = byClient.get(c.id)!;
    return {
      id: c.id,
      matchGroup: c.set1AccountNumber ?? "—",
      company: c.companyName,
      ledgerAccountGroup: c.set1AccountNumber
        ? c.set1AccountNumber.slice(0, 2) + "xx"
        : "—",
      openItems: agg.openSet1 + agg.openSet2,
      leftBalance: agg.leftBalance,
      rightBalance: agg.rightBalance,
      hasDoc: false,
      lastRecon: null as string | null,
      assignedUserId: c.assignedUserId,
      integrationSource: c.txSyncActive ? "tripletex" as const : null,
      syncStatus: c.syncStatus as string | null,
      syncError: c.syncError as string | null,
    };
  });

  // Fetch client groups
  const groupRows = await db
    .select({
      id: clientGroups.id,
      name: clientGroups.name,
      color: clientGroups.color,
      icon: clientGroups.icon,
      assignedUserId: clientGroups.assignedUserId,
    })
    .from(clientGroups)
    .where(eq(clientGroups.tenantId, orgId))
    .orderBy(clientGroups.name);

  let groups: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
    assignedUserId: string | null;
    members: { clientId: string; clientName: string; companyName: string }[];
  }[] = [];

  if (groupRows.length > 0) {
    const groupIds = groupRows.map((g) => g.id);
    const memberRows = await db
      .select({
        groupId: clientGroupMembers.groupId,
        clientId: clientGroupMembers.clientId,
        clientName: clients.name,
        companyName: companies.name,
      })
      .from(clientGroupMembers)
      .innerJoin(clients, eq(clientGroupMembers.clientId, clients.id))
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(inArray(clientGroupMembers.groupId, groupIds));

    const membersByGroup = new Map<string, typeof memberRows>();
    for (const m of memberRows) {
      const arr = membersByGroup.get(m.groupId) ?? [];
      arr.push(m);
      membersByGroup.set(m.groupId, arr);
    }

    groups = groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      icon: g.icon,
      assignedUserId: g.assignedUserId,
      members: (membersByGroup.get(g.id) ?? []).map((m) => ({
        clientId: m.clientId,
        clientName: m.clientName,
        companyName: m.companyName,
      })),
    }));
  }

  return (
    <ClientsPageClient
      rows={rows}
      groups={groups}
      accountSyncRows={accountSyncRows}
      companyId={companyIds[0] ?? null}
    />
  );
}
