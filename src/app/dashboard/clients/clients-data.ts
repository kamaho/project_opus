import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
  clients,
  companies,
  accounts,
  transactions,
  clientGroups,
  clientGroupMembers,
  tripletexSyncConfigs,
  vismaNxtSyncConfigs,
  accountSyncSettings,
} from "@/lib/db/schema";
import { eq, and, sql, inArray, asc, desc } from "drizzle-orm";

type ClientRow = {
  id: string;
  matchGroup: string;
  company: string;
  ledgerAccountGroup: string;
  openItems: number;
  leftBalance: number;
  rightBalance: number;
  hasDoc: boolean;
  lastRecon: string | null;
  assignedUserId: string | null;
  integrationSource: "tripletex" | "visma_nxt" | null;
  syncStatus: string | null;
  syncError: string | null;
};

type GroupData = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  assignedUserId: string | null;
  members: { clientId: string; clientName: string; companyName: string }[];
};

type ClientsPageResult =
  | { type: "data"; rows: ClientRow[]; groups: GroupData[] }
  | { type: "empty" }
  | { type: "sync-in-progress" };

const CACHE_TTL = 30;

async function fetchClientsPageDataInner(
  orgId: string,
  selectedCompanyIds: string[]
): Promise<ClientsPageResult> {
  const companyFilter =
    selectedCompanyIds.length > 0
      ? and(eq(companies.tenantId, orgId), inArray(companies.id, selectedCompanyIds))
      : eq(companies.tenantId, orgId);

  const acctSyncFilter =
    selectedCompanyIds.length > 0
      ? and(eq(accountSyncSettings.tenantId, orgId), inArray(accountSyncSettings.companyId, selectedCompanyIds))
      : eq(accountSyncSettings.tenantId, orgId);

  const [list, _companyRows, rawAcctRows, groupRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        status: clients.status,
        companyName: companies.name,
        set1AccountNumber: accounts.accountNumber,
        assignedUserId: clients.assignedUserId,
        txSyncActive: tripletexSyncConfigs.isActive,
        syncStatus: tripletexSyncConfigs.syncStatus,
        syncError: tripletexSyncConfigs.syncError,
        vismaSyncActive: vismaNxtSyncConfigs.isActive,
        vismaSyncStatus: vismaNxtSyncConfigs.syncStatus,
      })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .innerJoin(accounts, eq(clients.set1AccountId, accounts.id))
      .leftJoin(tripletexSyncConfigs, eq(tripletexSyncConfigs.clientId, clients.id))
      .leftJoin(vismaNxtSyncConfigs, eq(vismaNxtSyncConfigs.clientId, clients.id))
      .where(companyFilter)
      .orderBy(asc(accounts.accountNumber)),
    db.select({ id: companies.id }).from(companies).where(companyFilter),
    db
      .select()
      .from(accountSyncSettings)
      .where(acctSyncFilter)
      .orderBy(desc(accountSyncSettings.syncLevel), asc(accountSyncSettings.accountNumber)),
    db
      .select({
        id: clientGroups.id,
        name: clientGroups.name,
        color: clientGroups.color,
        icon: clientGroups.icon,
        assignedUserId: clientGroups.assignedUserId,
      })
      .from(clientGroups)
      .where(eq(clientGroups.tenantId, orgId))
      .orderBy(clientGroups.name),
  ]);

  const clientIds = list.map((c) => c.id);

  const accountSyncRows = rawAcctRows.map((r) => ({
    accountNumber: r.accountNumber,
    balanceIn: r.balanceIn,
  }));

  if (clientIds.length === 0 && rawAcctRows.length === 0) {
    if (selectedCompanyIds.length === 1) {
      const [selectedCo] = await db
        .select({ tripletexCompanyId: companies.tripletexCompanyId })
        .from(companies)
        .where(and(eq(companies.id, selectedCompanyIds[0]), eq(companies.tenantId, orgId)))
        .limit(1);

      if (selectedCo?.tripletexCompanyId != null) {
        return { type: "sync-in-progress" };
      }
    }
    return { type: "empty" };
  }

  const groupIds = groupRows.map((g) => g.id);

  const [unmatchedCounts, totalBalances, memberRows] = await Promise.all([
    clientIds.length > 0
      ? db
          .select({
            clientId: transactions.clientId,
            setNumber: transactions.setNumber,
            count: sql<number>`count(*)::int`,
          })
          .from(transactions)
          .where(and(inArray(transactions.clientId, clientIds), eq(transactions.matchStatus, "unmatched")))
          .groupBy(transactions.clientId, transactions.setNumber)
      : Promise.resolve([]),
    clientIds.length > 0
      ? db
          .select({
            clientId: transactions.clientId,
            setNumber: transactions.setNumber,
            sum: sql<string>`coalesce(sum(${transactions.amount})::text, '0')`,
          })
          .from(transactions)
          .where(inArray(transactions.clientId, clientIds))
          .groupBy(transactions.clientId, transactions.setNumber)
      : Promise.resolve([]),
    groupIds.length > 0
      ? db
          .select({
            groupId: clientGroupMembers.groupId,
            clientId: clientGroupMembers.clientId,
            clientName: clients.name,
            companyName: companies.name,
          })
          .from(clientGroupMembers)
          .innerJoin(clients, eq(clientGroupMembers.clientId, clients.id))
          .innerJoin(companies, eq(clients.companyId, companies.id))
          .where(inArray(clientGroupMembers.groupId, groupIds))
      : Promise.resolve([]),
  ]);

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
    if (r.setNumber === 1) cur.openSet1 = Number(r.count) ?? 0;
    else cur.openSet2 = Number(r.count) ?? 0;
  }
  for (const r of totalBalances) {
    const cur = byClient.get(r.clientId);
    if (!cur) continue;
    const sum = parseFloat(r.sum ?? "0");
    if (r.setNumber === 1) cur.leftBalance += sum;
    else cur.rightBalance += sum;
  }

  const rows: ClientRow[] = list.map((c) => {
    const agg = byClient.get(c.id)!;
    return {
      id: c.id,
      matchGroup: c.set1AccountNumber ?? "—",
      company: c.companyName,
      ledgerAccountGroup: c.set1AccountNumber ? c.set1AccountNumber.slice(0, 2) + "xx" : "—",
      openItems: agg.openSet1 + agg.openSet2,
      leftBalance: agg.leftBalance,
      rightBalance: agg.rightBalance,
      hasDoc: false,
      lastRecon: null,
      assignedUserId: c.assignedUserId,
      integrationSource: c.txSyncActive
        ? "tripletex"
        : c.vismaSyncActive
          ? "visma_nxt"
          : null,
      syncStatus: c.syncStatus as string | null,
      syncError: c.syncError as string | null,
    };
  });

  const membersByGroup = new Map<string, { clientId: string; clientName: string; companyName: string }[]>();
  for (const m of memberRows) {
    const arr = membersByGroup.get(m.groupId) ?? [];
    arr.push({ clientId: m.clientId, clientName: m.clientName, companyName: m.companyName });
    membersByGroup.set(m.groupId, arr);
  }

  const groups: GroupData[] = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    icon: g.icon,
    assignedUserId: g.assignedUserId,
    members: membersByGroup.get(g.id) ?? [],
  }));

  return { type: "data", rows, groups };
}

export const fetchClientsPageData = unstable_cache(
  fetchClientsPageDataInner,
  ["clients-page-data"],
  { revalidate: CACHE_TTL, tags: ["clients", "companies"] }
);
