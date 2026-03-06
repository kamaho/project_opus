import { db } from "@/lib/db";
import {
  companies,
  accounts,
  transactions,
  vismaNxtSyncConfigs,
  accountSyncSettings,
  clients,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { query, fetchAllPages } from "./client";
import { mapCompany, mapAccount, mapPosting } from "./mappers";
import {
  GET_COMPANIES,
  GET_ACCOUNTS,
  GET_TRANSACTIONS_BY_YEAR,
  GET_TRIAL_BALANCE,
} from "./queries";
import type {
  VnxtCompany,
  VnxtCompanyRaw,
  VnxtAccount,
  VnxtTransaction,
  VnxtAggregatedBalance,
  VnxtPaginatedResponse,
} from "./types";
import type { MappedTransaction, EnabledFields } from "@/lib/tripletex/mappers";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SyncResult {
  postings: { fetched: number; inserted: number };
  balancesUpdated: boolean;
}

// ---------------------------------------------------------------------------
// getCompanies — fetch accessible companies from Visma NXT
// ---------------------------------------------------------------------------

export async function getCompanies(
  tenantId: string
): Promise<VnxtCompany[]> {
  const data = await query<{
    availableCompanies: { totalCount: number; items: VnxtCompanyRaw[] };
  }>(tenantId, GET_COMPANIES);

  const items = data.availableCompanies?.items ?? [];
  return items.map((c) => ({
    companyNo: c.vismaNetCompanyId,
    companyName: c.name,
    customerNo: c.vismaNetCustomerId,
  }));
}

// ---------------------------------------------------------------------------
// syncCompany — upsert a Visma NXT company into Revizo
// ---------------------------------------------------------------------------

export async function syncCompany(
  companyNo: number,
  tenantId: string
): Promise<string> {
  const all = await getCompanies(tenantId);
  const vnxtCompany = all.find((c) => c.companyNo === companyNo);
  if (!vnxtCompany) {
    throw new Error(`Visma NXT company ${companyNo} not found for tenant`);
  }

  const mapped = mapCompany(vnxtCompany);

  // 1. Exact match by visma_nxt_company_no
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.tenantId, tenantId),
        eq(companies.vismaNxtCompanyNo, companyNo)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(companies)
      .set({
        name: mapped.name,
        orgNumber: mapped.orgNumber,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(companies)
    .values({
      tenantId,
      name: mapped.name,
      orgNumber: mapped.orgNumber,
      vismaNxtCompanyNo: companyNo,
    })
    .returning({ id: companies.id });

  return inserted.id;
}

// ---------------------------------------------------------------------------
// syncAccountList — fetch chart of accounts and upsert into accountSyncSettings
// ---------------------------------------------------------------------------

export async function syncAccountList(
  companyNo: number,
  companyId: string,
  tenantId: string
): Promise<{ accountCount: number; duration: number }> {
  const t0 = Date.now();
  console.log(
    `[visma-nxt/sync] syncAccountList: company=${companyNo} tenant=${tenantId}`
  );

  const gqlQuery = `
    query GetAccountsPaginated($companyNo: Int!, $first: Int, $after: String) {
      useCompany(no: $companyNo) {
        generalLedgerAccount(first: $first, after: $after) {
          totalCount
          pageInfo { hasNextPage endCursor }
          items {
            accountNo
            name
            accountGroup
            accountSubType
            taxCode
          }
        }
      }
    }
  `;

  const allAccounts = await fetchAllPages<VnxtAccount, { useCompany: { generalLedgerAccount: VnxtPaginatedResponse<VnxtAccount> } }>(
    tenantId,
    gqlQuery,
    { companyNo },
    (data) => data.useCompany.generalLedgerAccount
  );

  console.log(
    `[visma-nxt/sync] Fetched ${allAccounts.length} accounts in ${Date.now() - t0}ms`
  );

  if (allAccounts.length === 0) {
    return { accountCount: 0, duration: Date.now() - t0 };
  }

  const now = new Date();
  const year = now.getFullYear();
  const BATCH_SIZE = 100;

  for (let i = 0; i < allAccounts.length; i += BATCH_SIZE) {
    const batch = allAccounts.slice(i, i + BATCH_SIZE);
    const rows = batch.map((vnxtAcc) => {
      const mapped = mapAccount(vnxtAcc);
      return {
        tenantId,
        companyId,
        accountNumber: mapped.accountNumber,
        accountName: mapped.name,
        vismaNxtAccountId: vnxtAcc.accountNo,
        accountType: mapped.accountType as "ledger" | "bank",
        syncLevel: "balance_only" as const,
        balanceYear: year,
        lastBalanceSyncAt: now,
      };
    });

    await db
      .insert(accountSyncSettings)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          accountSyncSettings.tenantId,
          accountSyncSettings.companyId,
          accountSyncSettings.accountNumber,
        ],
        set: {
          accountName: sql`excluded.account_name`,
          vismaNxtAccountId: sql`excluded.visma_nxt_account_id`,
          accountType: sql`excluded.account_type`,
          updatedAt: now,
        },
      });
  }

  // Batch upsert into accounts using unique index on (company_id, account_number)
  const accountRows = allAccounts.map((vnxtAcc) => {
    const mapped = mapAccount(vnxtAcc);
    return {
      companyId,
      accountNumber: mapped.accountNumber,
      name: mapped.name,
      accountType: mapped.accountType as "ledger" | "bank",
      vismaNxtAccountId: vnxtAcc.accountNo,
    };
  });

  for (let i = 0; i < accountRows.length; i += BATCH_SIZE) {
    await db
      .insert(accounts)
      .values(accountRows.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: [accounts.companyId, accounts.accountNumber, accounts.accountType],
        set: {
          name: sql`excluded.name`,
          vismaNxtAccountId: sql`excluded.visma_nxt_account_id`,
        },
      });
  }

  const duration = Date.now() - t0;
  console.log(
    `[visma-nxt/sync] syncAccountList done: ${allAccounts.length} accounts in ${duration}ms`
  );
  return { accountCount: allAccounts.length, duration };
}

// ---------------------------------------------------------------------------
// syncBalancesForAccounts — compute balances via groupBy aggregation
// ---------------------------------------------------------------------------

export async function syncBalancesForAccounts(
  companyNo: number,
  companyId: string,
  tenantId: string
): Promise<{ balancesUpdated: number; duration: number }> {
  const t0 = Date.now();
  const year = new Date().getFullYear();

  console.log(
    `[visma-nxt/sync] syncBalances: computing trial balance for year ${year}`
  );

  interface TrialBalanceData {
    useCompany: {
      generalLedgerTransaction: {
        items: VnxtAggregatedBalance[];
      };
    };
  }

  const data = await query<TrialBalanceData>(tenantId, GET_TRIAL_BALANCE, {
    companyNo,
    year,
    periodFrom: 1,
    periodTo: 12,
  });

  const balanceItems =
    data.useCompany?.generalLedgerTransaction?.items ?? [];

  console.log(
    `[visma-nxt/sync] Trial balance returned ${balanceItems.length} accounts in ${Date.now() - t0}ms`
  );

  if (balanceItems.length === 0) {
    return { balancesUpdated: 0, duration: Date.now() - t0 };
  }

  const balanceMap = new Map<string, number>();
  for (const item of balanceItems) {
    balanceMap.set(
      String(item.accountNo),
      item.aggregates.sum.postedAmountDomestic
    );
  }

  const rows = await db
    .select({
      accountNumber: accountSyncSettings.accountNumber,
    })
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.tenantId, tenantId),
        eq(accountSyncSettings.companyId, companyId)
      )
    );

  const now = new Date();
  const toUpdateBalances = rows
    .filter((acct) => balanceMap.has(acct.accountNumber))
    .map((acct) => ({
      accountNumber: acct.accountNumber,
      balance: balanceMap.get(acct.accountNumber)!.toFixed(2),
    }));

  if (toUpdateBalances.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toUpdateBalances.length; i += CHUNK) {
      const chunk = toUpdateBalances.slice(i, i + CHUNK);
      const valuesFragments = chunk.map(
        (b) => sql`(${b.accountNumber}, ${b.balance}::numeric)`
      );
      const valuesSql = sql.join(valuesFragments, sql`, `);

      const nowIso = now.toISOString();
      await db.execute(sql`
        UPDATE account_sync_settings SET
          balance_out = v.bal,
          balance_year = ${year},
          last_balance_sync_at = ${nowIso}::timestamptz,
          updated_at = ${nowIso}::timestamptz
        FROM (VALUES ${valuesSql}) AS v(acct, bal)
        WHERE account_sync_settings.tenant_id = ${tenantId}
          AND account_sync_settings.company_id = ${companyId}
          AND account_sync_settings.account_number = v.acct
      `);
    }
  }

  const balancesUpdated = toUpdateBalances.length;

  const duration = Date.now() - t0;
  console.log(
    `[visma-nxt/sync] syncBalances done: ${balancesUpdated} balances in ${duration}ms`
  );
  return { balancesUpdated, duration };
}

// ---------------------------------------------------------------------------
// syncPostings — fetch GL transactions for configured accounts
// ---------------------------------------------------------------------------

const TX_BATCH_SIZE = 500;

async function insertTransactionsBatch(
  clientId: string,
  rows: MappedTransaction[]
) {
  if (rows.length === 0) return 0;

  const existingRows = await db
    .select({ externalId: transactions.externalId })
    .from(transactions)
    .where(
      and(
        eq(transactions.clientId, clientId),
        sql`${transactions.externalId} IS NOT NULL`
      )
    );

  const existingIds = new Set(existingRows.map((r) => r.externalId));
  const newRows = rows.filter((r) => !existingIds.has(r.externalId));

  if (newRows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < newRows.length; i += TX_BATCH_SIZE) {
    const batch = newRows.slice(i, i + TX_BATCH_SIZE);
    const result = await db
      .insert(transactions)
      .values(
        batch.map((r) => ({
          clientId,
          setNumber: r.setNumber,
          accountNumber: r.accountNumber,
          amount: r.amount,
          foreignAmount: r.foreignAmount,
          currency: r.currency,
          date1: r.date1,
          description: r.description,
          bilag: r.bilag,
          faktura: r.faktura,
          reference: r.reference,
          sign: r.sign,
          sourceType: r.sourceType,
          externalId: r.externalId,
          matchStatus: r.matchStatus,
        }))
      )
      .returning({ id: transactions.id });

    inserted += result.length;
  }
  return inserted;
}

export async function syncPostings(
  config: typeof vismaNxtSyncConfigs.$inferSelect
): Promise<{ fetched: number; inserted: number }> {
  const accountIds = config.set1AccountIds ?? [];
  if (accountIds.length === 0) return { fetched: 0, inserted: 0 };

  const enabledFields = (config.enabledFields as EnabledFields | null) ?? null;
  const year = new Date().getFullYear();
  let totalFetched = 0;
  let totalInserted = 0;

  for (const accountNo of accountIds) {
    interface TxData {
      useCompany: {
        generalLedgerTransaction: VnxtPaginatedResponse<VnxtTransaction>;
      };
    }

    const allTx = await fetchAllPages<VnxtTransaction, TxData>(
      config.tenantId,
      GET_TRANSACTIONS_BY_YEAR.replace("$year: Int!", "$year: Int!, $accountNo: Int")
        .replace(
          "filter: { year: { _eq: $year } }",
          "filter: { _and: [{ year: { _eq: $year } }, { accountNo: { _eq: $accountNo } }] }"
        ),
      { companyNo: config.vismaCompanyNo, year, accountNo },
      (data) => data.useCompany.generalLedgerTransaction
    );

    const mapped = allTx.map((t) => mapPosting(t, enabledFields));
    const inserted = await insertTransactionsBatch(config.clientId, mapped);
    totalFetched += allTx.length;
    totalInserted += inserted;
  }

  await db
    .update(vismaNxtSyncConfigs)
    .set({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vismaNxtSyncConfigs.id, config.id));

  return { fetched: totalFetched, inserted: totalInserted };
}

// ---------------------------------------------------------------------------
// syncTransactionsForAccount — full sync for a single config
// ---------------------------------------------------------------------------

export async function syncTransactionsForAccount(
  configId: string
): Promise<SyncResult> {
  const [config] = await db
    .select()
    .from(vismaNxtSyncConfigs)
    .where(eq(vismaNxtSyncConfigs.id, configId))
    .limit(1);

  if (!config) {
    throw new Error(`Visma NXT sync config not found: ${configId}`);
  }

  const t0 = Date.now();
  console.log(
    `[visma-nxt/sync] syncTransactionsForAccount: config=${configId} client=${config.clientId}`
  );

  await db
    .update(vismaNxtSyncConfigs)
    .set({ syncStatus: "syncing", syncError: null, updatedAt: new Date() })
    .where(eq(vismaNxtSyncConfigs.id, configId));

  try {
    const postings = await syncPostings(config);

    let balancesUpdated = false;
    try {
      const companyId = await getCompanyIdForConfig(config);
      if (companyId) {
        await syncBalancesForAccounts(
          config.vismaCompanyNo,
          companyId,
          config.tenantId
        );
        balancesUpdated = true;
      }
    } catch {
      // non-fatal
    }

    await db
      .update(vismaNxtSyncConfigs)
      .set({
        syncStatus: "completed",
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(vismaNxtSyncConfigs.id, configId));

    console.log(
      `[visma-nxt/sync] config=${configId} completed in ${Date.now() - t0}ms: postings=${postings.inserted}`
    );
    return { postings, balancesUpdated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[visma-nxt/sync] config=${configId} FAILED after ${Date.now() - t0}ms:`,
      msg
    );

    await db
      .update(vismaNxtSyncConfigs)
      .set({
        syncStatus: "failed",
        syncError: msg.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(vismaNxtSyncConfigs.id, configId));

    throw error;
  }
}

// ---------------------------------------------------------------------------
// runFullSync — orchestrator for initial or scheduled sync
// ---------------------------------------------------------------------------

export async function runFullSync(configId: string): Promise<SyncResult> {
  const [config] = await db
    .select()
    .from(vismaNxtSyncConfigs)
    .where(eq(vismaNxtSyncConfigs.id, configId))
    .limit(1);

  if (!config) {
    throw new Error(`Visma NXT sync config not found: ${configId}`);
  }

  const t0 = Date.now();
  console.log(
    `[visma-nxt/sync] Starting full sync for config=${configId} client=${config.clientId}`
  );

  await db
    .update(vismaNxtSyncConfigs)
    .set({ syncStatus: "syncing", syncError: null, updatedAt: new Date() })
    .where(eq(vismaNxtSyncConfigs.id, configId));

  try {
    const companyId = await syncCompany(
      config.vismaCompanyNo,
      config.tenantId
    );

    await syncAccountList(
      config.vismaCompanyNo,
      companyId,
      config.tenantId
    );

    const postings = await syncPostings(config);

    let balancesUpdated = false;
    try {
      await syncBalancesForAccounts(
        config.vismaCompanyNo,
        companyId,
        config.tenantId
      );
      balancesUpdated = true;
    } catch {
      // non-fatal
    }

    await db
      .update(vismaNxtSyncConfigs)
      .set({
        syncStatus: "completed",
        syncError: null,
        initialSyncCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(vismaNxtSyncConfigs.id, configId));

    console.log(
      `[visma-nxt/sync] Full sync completed in ${Date.now() - t0}ms`
    );
    return { postings, balancesUpdated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[visma-nxt/sync] Full sync FAILED after ${Date.now() - t0}ms:`,
      msg
    );

    await db
      .update(vismaNxtSyncConfigs)
      .set({
        syncStatus: "failed",
        syncError: msg.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(vismaNxtSyncConfigs.id, configId));

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCompanyIdForConfig(
  config: typeof vismaNxtSyncConfigs.$inferSelect
): Promise<string | null> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.tenantId, config.tenantId),
        eq(companies.vismaNxtCompanyNo, config.vismaCompanyNo)
      )
    )
    .limit(1);
  return company?.id ?? null;
}
