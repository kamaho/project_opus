import { db } from "@/lib/db";
import {
  companies,
  accounts,
  transactions,
  tripletexSyncConfigs,
  accountSyncSettings,
  clients,
} from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { tripletexGet } from "@/lib/tripletex";
import { fetchAllPages } from "./pagination";
import { refreshClientStats } from "@/lib/db/refresh-stats";
import {
  mapCompany,
  mapAccount,
  mapPosting,
  mapBankTransaction,
  type MappedTransaction,
  type EnabledFields,
} from "./mappers";
import type {
  TxCompany,
  TxAccount,
  TxPosting,
  TxBankTransaction,
  TxBalance,
} from "./types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface SyncResult {
  postings: { fetched: number; inserted: number };
  bankTransactions: { fetched: number; inserted: number };
  balancesUpdated: boolean;
}

// ---------------------------------------------------------------------------
// syncCompany — upsert a Tripletex company into Revizo
// ---------------------------------------------------------------------------

export async function syncCompany(
  tripletexCompanyId: number,
  tenantId: string
): Promise<string> {
  const res = await tripletexGet<{ value: TxCompany }>(
    `/company/${tripletexCompanyId}`,
    { fields: "*" },
    tenantId
  );

  const mapped = mapCompany(res.value);

  // 1. Exact match by tripletex_company_id
  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        eq(companies.tenantId, tenantId),
        eq(companies.tripletexCompanyId, tripletexCompanyId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(companies)
      .set({ name: mapped.name, orgNumber: mapped.orgNumber, updatedAt: new Date() })
      .where(eq(companies.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(companies)
    .values({
      tenantId,
      name: mapped.name,
      orgNumber: mapped.orgNumber,
      tripletexCompanyId,
    })
    .returning({ id: companies.id });

  return inserted.id;
}

// ---------------------------------------------------------------------------
// syncAccounts — pull full chart of accounts for a company
// ---------------------------------------------------------------------------

export async function syncAccounts(
  tripletexCompanyId: number,
  companyId: string,
  tenantId?: string
): Promise<number> {
  const all = await fetchAllPages<TxAccount>("/ledger/account", {
    fields: "id,number,name,isBankAccount,currency(*)",
  }, tenantId);

  if (all.length === 0) return 0;

  // Fetch existing accounts in one query
  const existing = await db
    .select({
      id: accounts.id,
      tripletexAccountId: accounts.tripletexAccountId,
    })
    .from(accounts)
    .where(eq(accounts.companyId, companyId));

  const existingByTxId = new Map(
    existing
      .filter((e) => e.tripletexAccountId != null)
      .map((e) => [e.tripletexAccountId!, e.id])
  );

  const toInsert: Array<{
    companyId: string;
    accountNumber: string;
    name: string;
    accountType: "ledger" | "bank";
    tripletexAccountId: number;
  }> = [];

  const toUpdate: Array<{ id: string; accountNumber: string; name: string; accountType: "ledger" | "bank" }> = [];

  for (const txAcc of all) {
    const mapped = mapAccount(txAcc);

    if (existingByTxId.has(txAcc.id)) {
      toUpdate.push({
        id: existingByTxId.get(txAcc.id)!,
        accountNumber: mapped.accountNumber,
        name: mapped.name,
        accountType: mapped.accountType,
      });
    } else {
      toInsert.push({
        companyId,
        accountNumber: mapped.accountNumber,
        name: mapped.name,
        accountType: mapped.accountType,
        tripletexAccountId: txAcc.id,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += 500) {
    await db
      .insert(accounts)
      .values(toInsert.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [accounts.companyId, accounts.accountNumber, accounts.accountType],
        set: {
          name: sql`excluded.name`,
          tripletexAccountId: sql`excluded.tripletex_account_id`,
        },
      });
  }

  if (toUpdate.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      const valuesFragments = chunk.map(
        (u) => sql`(${u.id}, ${u.accountNumber}, ${u.name}, ${u.accountType})`
      );
      const valuesSql = sql.join(valuesFragments, sql`, `);
      await db.execute(sql`
        UPDATE accounts SET
          account_number = v.acct_num,
          name = v.acct_name,
          account_type = v.acct_type
        FROM (VALUES ${valuesSql}) AS v(id, acct_num, acct_name, acct_type)
        WHERE accounts.id = v.id::uuid
      `);
    }
  }

  return toInsert.length + toUpdate.length;
}

// ---------------------------------------------------------------------------
// syncAccountsAndBalances — Level 1: chart of accounts + balances (seconds)
// ---------------------------------------------------------------------------

export interface AccountsAndBalancesResult {
  accountCount: number;
  balancesUpdated: number;
  duration: number;
}

/**
 * Phase 1 only: fetch account list from Tripletex and insert into DB.
 * Returns in seconds — no balance fetching.
 */
export async function syncAccountList(
  tripletexCompanyId: number,
  companyId: string,
  tenantId: string
): Promise<{ accountCount: number; duration: number }> {
  const t0 = Date.now();
  console.log(`[sync] syncAccountList: company=${tripletexCompanyId} tenant=${tenantId}`);

  const allAccounts = await fetchAllPages<TxAccount>("/ledger/account", {
    fields: "id,number,name,isBankAccount,currency(*)",
  }, tenantId);

  console.log(`[sync] Fetched ${allAccounts.length} accounts from Tripletex in ${Date.now() - t0}ms`);

  if (allAccounts.length === 0) {
    return { accountCount: 0, duration: Date.now() - t0 };
  }

  const now = new Date();
  const year = new Date().getFullYear();

  const syncSettingsRows = allAccounts.map((txAcc) => {
    const mapped = mapAccount(txAcc);
    return {
      tenantId,
      companyId,
      accountNumber: mapped.accountNumber,
      accountName: mapped.name,
      tripletexAccountId: txAcc.id,
      accountType: mapped.accountType as "ledger" | "bank",
      syncLevel: "balance_only" as const,
      balanceYear: year,
      lastBalanceSyncAt: now,
    };
  });

  const accountRows = allAccounts.map((txAcc) => {
    const mapped = mapAccount(txAcc);
    return {
      companyId,
      accountNumber: mapped.accountNumber,
      name: mapped.name,
      accountType: mapped.accountType as "ledger" | "bank",
      tripletexAccountId: txAcc.id,
    };
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(accountSyncSettings)
      .values(syncSettingsRows)
      .onConflictDoUpdate({
        target: [accountSyncSettings.tenantId, accountSyncSettings.companyId, accountSyncSettings.accountNumber],
        set: {
          accountName: sql`excluded.account_name`,
          tripletexAccountId: sql`excluded.tripletex_account_id`,
          accountType: sql`excluded.account_type`,
          updatedAt: now,
        },
      });

    await tx
      .insert(accounts)
      .values(accountRows)
      .onConflictDoUpdate({
        target: [accounts.companyId, accounts.accountNumber, accounts.accountType],
        set: {
          name: sql`excluded.name`,
          tripletexAccountId: sql`excluded.tripletex_account_id`,
        },
      });
  });

  const duration = Date.now() - t0;
  console.log(`[sync] syncAccountList done: ${allAccounts.length} accounts in ${duration}ms`);
  return { accountCount: allAccounts.length, duration };
}

interface BalanceSheetRow {
  account: { id: number };
  balanceIn?: number;
  balanceOut?: number;
  balanceChange?: number;
}

/**
 * Phase 2: fetch balances via /balanceSheet (single API call for all accounts).
 * Replaces the old per-account /balance approach that returned 404s.
 */
export async function syncBalancesForAccounts(
  companyId: string,
  tenantId: string
): Promise<{ balancesUpdated: number; duration: number }> {
  const t0 = Date.now();
  const year = new Date().getFullYear();
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  console.log(`[sync] syncBalances: fetching /balanceSheet for ${dateFrom} to ${dateTo}`);

  const balanceRows = await fetchAllPages<BalanceSheetRow>("/balanceSheet", {
    dateFrom,
    dateTo,
    accountNumberFrom: "1000",
    accountNumberTo: "9999",
    fields: "account(id),balanceIn,balanceOut",
  }, tenantId);

  console.log(`[sync] /balanceSheet returned ${balanceRows.length} rows in ${Date.now() - t0}ms`);

  if (balanceRows.length === 0) {
    return { balancesUpdated: 0, duration: Date.now() - t0 };
  }

  const balanceMap = new Map<number, { balanceIn: number | null; balanceOut: number | null }>();
  for (const row of balanceRows) {
    balanceMap.set(row.account.id, {
      balanceIn: row.balanceIn ?? null,
      balanceOut: row.balanceOut ?? null,
    });
  }

  const rows = await db
    .select({
      tripletexAccountId: accountSyncSettings.tripletexAccountId,
      accountNumber: accountSyncSettings.accountNumber,
    })
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.tenantId, tenantId),
        eq(accountSyncSettings.companyId, companyId),
      )
    );

  const now = new Date();
  const nowIso = now.toISOString();

  const toUpdate: Array<{ accountNumber: string; balanceIn: string | null; balanceOut: string | null }> = [];
  for (const acct of rows) {
    if (acct.tripletexAccountId == null) continue;
    const balance = balanceMap.get(acct.tripletexAccountId);
    if (!balance) continue;
    toUpdate.push({
      accountNumber: acct.accountNumber,
      balanceIn: balance.balanceIn?.toFixed(2) ?? null,
      balanceOut: balance.balanceOut?.toFixed(2) ?? null,
    });
  }

  if (toUpdate.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      const valuesFragments = chunk.map(
        (b) => sql`(${b.accountNumber}, ${b.balanceIn}::numeric, ${b.balanceOut}::numeric)`
      );
      const valuesSql = sql.join(valuesFragments, sql`, `);
      await db.execute(sql`
        UPDATE account_sync_settings SET
          balance_in = v.bal_in,
          balance_out = v.bal_out,
          balance_year = ${year},
          last_balance_sync_at = ${nowIso}::timestamptz,
          updated_at = ${nowIso}::timestamptz
        FROM (VALUES ${valuesSql}) AS v(acct, bal_in, bal_out)
        WHERE account_sync_settings.tenant_id = ${tenantId}
          AND account_sync_settings.company_id = ${companyId}
          AND account_sync_settings.account_number = v.acct
      `);
    }
  }

  const duration = Date.now() - t0;
  console.log(`[sync] syncBalances done: ${toUpdate.length} balances in ${duration}ms`);
  return { balancesUpdated: toUpdate.length, duration };
}

/**
 * Full sync: Phase 1 (accounts) + Phase 2 (balances).
 * Use syncAccountList + syncBalancesForAccounts separately when you need
 * to return after Phase 1 and run Phase 2 in background.
 */
export async function syncAccountsAndBalances(
  tripletexCompanyId: number,
  companyId: string,
  tenantId: string
): Promise<AccountsAndBalancesResult> {
  const phase1 = await syncAccountList(tripletexCompanyId, companyId, tenantId);
  if (phase1.accountCount === 0) {
    return { accountCount: 0, balancesUpdated: 0, duration: phase1.duration };
  }
  const phase2 = await syncBalancesForAccounts(companyId, tenantId);
  return {
    accountCount: phase1.accountCount,
    balancesUpdated: phase2.balancesUpdated,
    duration: phase1.duration + phase2.duration,
  };
}

// ---------------------------------------------------------------------------
// syncTransactionsForAccount — Level 2: on-demand transaction sync for one account
// ---------------------------------------------------------------------------

export async function syncTransactionsForAccount(
  configId: string
): Promise<SyncResult> {
  const [config] = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(eq(tripletexSyncConfigs.id, configId))
    .limit(1);

  if (!config) {
    throw new Error(`Sync config not found: ${configId}`);
  }

  const t0 = Date.now();
  console.log(`[sync] syncTransactionsForAccount: config=${configId} client=${config.clientId}`);

  await db
    .update(tripletexSyncConfigs)
    .set({ syncStatus: "syncing", syncError: null, updatedAt: new Date() })
    .where(eq(tripletexSyncConfigs.id, configId));

  try {
    const [postings, bankTransactions] = await Promise.all([
      syncPostings(config),
      syncBankTransactions(config),
    ]);

    let balancesUpdated = false;
    try {
      await syncBalances(config);
      balancesUpdated = true;
    } catch {
      // non-fatal
    }

    // Update account_sync_settings tx_count
    const totalTx = postings.inserted + bankTransactions.inserted;
    const accountIds = [
      ...(config.set1TripletexAccountIds ?? []),
      ...(config.set2TripletexAccountIds ?? []),
    ];
    if (accountIds.length > 0) {
      await db
        .update(accountSyncSettings)
        .set({ lastTxSyncAt: new Date(), txCount: totalTx, updatedAt: new Date() })
        .where(
          and(
            eq(accountSyncSettings.tenantId, config.tenantId),
            inArray(accountSyncSettings.tripletexAccountId, accountIds)
          )
        );
    }

    await db
      .update(tripletexSyncConfigs)
      .set({ syncStatus: "completed", syncError: null, updatedAt: new Date() })
      .where(eq(tripletexSyncConfigs.id, configId));

    console.log(`[sync] syncTransactionsForAccount config=${configId} completed in ${Date.now() - t0}ms: postings=${postings.inserted}, bankTx=${bankTransactions.inserted}`);
    return { postings, bankTransactions, balancesUpdated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[sync] syncTransactionsForAccount config=${configId} FAILED after ${Date.now() - t0}ms:`, msg);

    await db
      .update(tripletexSyncConfigs)
      .set({ syncStatus: "failed", syncError: msg.slice(0, 2000), updatedAt: new Date() })
      .where(eq(tripletexSyncConfigs.id, configId));

    throw error;
  }
}

// ---------------------------------------------------------------------------
// syncPostings — incremental fetch of ledger postings (Set 1)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 500;

async function insertTransactionsBatch(
  clientId: string,
  rows: MappedTransaction[]
) {
  if (rows.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const batchExternalIds = batch
      .map((r) => r.externalId)
      .filter((id): id is string => id != null);

    let existingIds = new Set<string | null>();
    if (batchExternalIds.length > 0) {
      const existingRows = await db
        .select({ externalId: transactions.externalId })
        .from(transactions)
        .where(
          and(
            eq(transactions.clientId, clientId),
            inArray(transactions.externalId, batchExternalIds)
          )
        );
      existingIds = new Set(existingRows.map((r) => r.externalId));
    }

    const newRows = batch.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    if (newRows.length === 0) continue;

    const result = await db
      .insert(transactions)
      .values(
        newRows.map((r) => ({
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
  config: typeof tripletexSyncConfigs.$inferSelect
): Promise<{ fetched: number; inserted: number }> {
  const accountIds: number[] = config.set1TripletexAccountIds?.length
    ? config.set1TripletexAccountIds
    : config.set1TripletexAccountId
      ? [config.set1TripletexAccountId]
      : [];

  if (accountIds.length === 0) return { fetched: 0, inserted: 0 };

  const enabledFields = (config.enabledFields as EnabledFields | null) ?? null;
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() + 30);
  const dateToStr = dateTo.toISOString().split("T")[0];
  let totalFetched = 0;
  let totalInserted = 0;

  const lastId = config.lastSyncPostingId ?? 0;

  for (const accountId of accountIds) {
    const params: Record<string, string | number | boolean> = {
      dateFrom: config.dateFrom,
      dateTo: dateToStr,
      accountId,
      fields: "*,account(*),voucher(*),currency(*)",
    };

    if (lastId > 0) {
      params.id = `>${lastId}`;
    }

    const allPostings = await fetchAllPages<TxPosting>(
      "/ledger/posting",
      params,
      config.tenantId
    );

    const mapped = allPostings.map((p) => mapPosting(p, enabledFields));
    const inserted = await insertTransactionsBatch(config.clientId, mapped);
    totalFetched += allPostings.length;
    totalInserted += inserted;

    const maxId = allPostings.reduce((max, p) => Math.max(max, p.id), lastId);
    if (maxId > (config.lastSyncPostingId ?? 0)) {
      config = { ...config, lastSyncPostingId: maxId };
    }
  }

  await db
    .update(tripletexSyncConfigs)
    .set({
      lastSyncPostingId: config.lastSyncPostingId,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tripletexSyncConfigs.id, config.id));

  return { fetched: totalFetched, inserted: totalInserted };
}

// ---------------------------------------------------------------------------
// syncBankTransactions — incremental fetch of bank transactions (Set 2)
// ---------------------------------------------------------------------------

export async function syncBankTransactions(
  config: typeof tripletexSyncConfigs.$inferSelect
): Promise<{ fetched: number; inserted: number }> {
  const accountIds: number[] = config.set2TripletexAccountIds?.length
    ? config.set2TripletexAccountIds
    : config.set2TripletexAccountId
      ? [config.set2TripletexAccountId]
      : [];

  if (accountIds.length === 0) return { fetched: 0, inserted: 0 };

  const enabledFields = (config.enabledFields as EnabledFields | null) ?? null;
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() + 30);
  const dateToStr = dateTo.toISOString().split("T")[0];
  let totalFetched = 0;
  let totalInserted = 0;

  const lastId = config.lastSyncBankTxId ?? 0;

  for (const accountId of accountIds) {
    const params: Record<string, string | number | boolean> = {
      transactionDateFrom: config.dateFrom,
      transactionDateTo: dateToStr,
      accountId,
      fields: "*,account(*)",
    };

    if (lastId > 0) {
      params.id = `>${lastId}`;
    }

    const allTx = await fetchAllPages<TxBankTransaction>(
      "/bank/statement/transaction",
      params,
      config.tenantId
    );

    const mapped = allTx.map((bt) => mapBankTransaction(bt, enabledFields));
    const inserted = await insertTransactionsBatch(config.clientId, mapped);
    totalFetched += allTx.length;
    totalInserted += inserted;

    const maxId = allTx.reduce((max, t) => Math.max(max, t.id), lastId);
    if (maxId > (config.lastSyncBankTxId ?? 0)) {
      config = { ...config, lastSyncBankTxId: maxId };
    }
  }

  await db
    .update(tripletexSyncConfigs)
    .set({
      lastSyncBankTxId: config.lastSyncBankTxId,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tripletexSyncConfigs.id, config.id));

  return { fetched: totalFetched, inserted: totalInserted };
}

// ---------------------------------------------------------------------------
// syncBalances — fetch period balances and update client opening balance
// ---------------------------------------------------------------------------

export async function syncBalances(
  config: typeof tripletexSyncConfigs.$inferSelect
): Promise<void> {
  const year = new Date(config.dateFrom).getFullYear();

  const set1Ids: number[] = config.set1TripletexAccountIds?.length
    ? config.set1TripletexAccountIds
    : config.set1TripletexAccountId ? [config.set1TripletexAccountId] : [];

  const set2Ids: number[] = config.set2TripletexAccountIds?.length
    ? config.set2TripletexAccountIds
    : config.set2TripletexAccountId ? [config.set2TripletexAccountId] : [];

  // Use the first account in each set for opening balance
  if (set1Ids.length > 0) {
    try {
      const balRes = await fetchAllPages<TxBalance>("/balance", {
        accountId: set1Ids[0],
        year,
        fields: "*",
      }, config.tenantId);

      if (balRes.length > 0 && balRes[0].balanceIn != null) {
        await db
          .update(clients)
          .set({
            openingBalanceSet1: balRes[0].balanceIn.toFixed(2),
            openingBalanceDate: config.dateFrom,
          })
          .where(eq(clients.id, config.clientId));
      }
    } catch {
      // Balance endpoint may not be available for all account types
    }
  }

  if (set2Ids.length > 0) {
    try {
      const balRes = await fetchAllPages<TxBalance>("/balance", {
        accountId: set2Ids[0],
        year,
        fields: "*",
      }, config.tenantId);

      if (balRes.length > 0 && balRes[0].balanceIn != null) {
        await db
          .update(clients)
          .set({
            openingBalanceSet2: balRes[0].balanceIn.toFixed(2),
            openingBalanceDate: config.dateFrom,
          })
          .where(eq(clients.id, config.clientId));
      }
    } catch {
      // Balance endpoint may not be available for all account types
    }
  }
}

// ---------------------------------------------------------------------------
// runFullSync — orchestrator for a single client sync config (backward compat)
// ---------------------------------------------------------------------------

export interface RunFullSyncOptions {
  skipAccountSync?: boolean;
}

export async function runFullSync(
  configId: string,
  options?: RunFullSyncOptions
): Promise<SyncResult> {
  const [config] = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(eq(tripletexSyncConfigs.id, configId))
    .limit(1);

  if (!config) {
    throw new Error(`Sync config not found: ${configId}`);
  }

  const t0 = Date.now();
  console.log(`[sync] Starting full sync for config=${configId} client=${config.clientId}`);

  await db
    .update(tripletexSyncConfigs)
    .set({ syncStatus: "syncing", syncError: null, updatedAt: new Date() })
    .where(eq(tripletexSyncConfigs.id, configId));

  try {
    if (!options?.skipAccountSync) {
      const tCompany = Date.now();
      await syncCompany(config.tripletexCompanyId, config.tenantId);
      console.log(`[sync] config=${configId} syncCompany done in ${Date.now() - tCompany}ms`);

      const [clientRow] = await db
        .select({ companyId: clients.companyId })
        .from(clients)
        .where(eq(clients.id, config.clientId))
        .limit(1);

      const companyId = clientRow?.companyId;
      if (!companyId) {
        throw new Error(`Client ${config.clientId} not found — cannot determine company for account sync`);
      }

      const tAccounts = Date.now();
      await syncAccountList(config.tripletexCompanyId, companyId, config.tenantId);
      console.log(`[sync] config=${configId} syncAccountList done in ${Date.now() - tAccounts}ms`);
    } else {
      console.log(`[sync] config=${configId} skipping account sync (already done for this company)`);
    }

    const tPostings = Date.now();
    const [postings, bankTransactions] = await Promise.all([
      syncPostings(config),
      syncBankTransactions(config),
    ]);
    console.log(
      `[sync] config=${configId} postings: fetched=${postings.fetched} inserted=${postings.inserted} (${Date.now() - tPostings}ms)`
    );
    console.log(
      `[sync] config=${configId} bankTx: fetched=${bankTransactions.fetched} inserted=${bankTransactions.inserted} (${Date.now() - tPostings}ms)`
    );

    let balancesUpdated = false;
    try {
      await syncBalances(config);
      balancesUpdated = true;
    } catch {
      // non-fatal
    }

    await db
      .update(tripletexSyncConfigs)
      .set({ syncStatus: "completed", syncError: null, updatedAt: new Date() })
      .where(eq(tripletexSyncConfigs.id, configId));

    console.log(`[sync] config=${configId} completed in ${Date.now() - t0}ms`);
    refreshClientStats().catch(() => {});
    return { postings, bankTransactions, balancesUpdated };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[sync] config=${configId} FAILED after ${Date.now() - t0}ms:`, msg);

    await db
      .update(tripletexSyncConfigs)
      .set({ syncStatus: "failed", syncError: msg.slice(0, 2000), updatedAt: new Date() })
      .where(eq(tripletexSyncConfigs.id, configId));

    throw error;
  }
}

// ---------------------------------------------------------------------------
// syncBulkTransactionsForConfigs — fetch ALL postings for a company in one
// paginated call, then distribute to the right clients. Bank transactions
// are fetched per-account (API requires accountId) with concurrency.
// ---------------------------------------------------------------------------

export interface BulkSyncResult {
  postings: number;
  bankTx: number;
  configs: number;
  errors: number;
}

export async function syncBulkTransactionsForConfigs(
  configIds: string[]
): Promise<BulkSyncResult> {
  if (configIds.length === 0) return { postings: 0, bankTx: 0, configs: 0, errors: 0 };

  const t0 = Date.now();
  console.log(`[sync-bulk] Starting bulk sync for ${configIds.length} configs`);

  const configs = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(inArray(tripletexSyncConfigs.id, configIds));

  if (configs.length === 0) {
    console.log("[sync-bulk] No configs found");
    return { postings: 0, bankTx: 0, configs: 0, errors: 0 };
  }

  // Mark all as syncing
  await db
    .update(tripletexSyncConfigs)
    .set({ syncStatus: "syncing", syncError: null, updatedAt: new Date() })
    .where(inArray(tripletexSyncConfigs.id, configIds));

  // Group by tripletexCompanyId for multi-company safety
  const byCompany = new Map<number, typeof configs>();
  for (const c of configs) {
    const list = byCompany.get(c.tripletexCompanyId) ?? [];
    list.push(c);
    byCompany.set(c.tripletexCompanyId, list);
  }

  let totalPostings = 0;
  let totalBankTx = 0;
  let totalErrors = 0;

  for (const [companyId, companyConfigs] of byCompany) {
    try {
      const result = await syncBulkForCompany(companyId, companyConfigs);
      totalPostings += result.postings;
      totalBankTx += result.bankTx;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[sync-bulk] Company ${companyId} FAILED: ${msg.slice(0, 200)}`);
      totalErrors += companyConfigs.length;
      // Mark this company's configs as failed
      const failedIds = companyConfigs.map((c) => c.id);
      await db
        .update(tripletexSyncConfigs)
        .set({ syncStatus: "failed", syncError: msg.slice(0, 2000), updatedAt: new Date() })
        .where(inArray(tripletexSyncConfigs.id, failedIds));
    }
  }

  console.log(
    `[sync-bulk] Done in ${Date.now() - t0}ms: ${totalPostings} postings, ${totalBankTx} bankTx, ${configs.length - totalErrors}/${configs.length} configs OK`
  );

  refreshClientStats().catch(() => {});

  return {
    postings: totalPostings,
    bankTx: totalBankTx,
    configs: configs.length - totalErrors,
    errors: totalErrors,
  };
}

async function syncBulkForCompany(
  tripletexCompanyId: number,
  configs: (typeof tripletexSyncConfigs.$inferSelect)[]
): Promise<{ postings: number; bankTx: number }> {
  const t0 = Date.now();
  const tenantId = configs[0].tenantId;
  console.log(`[sync-bulk] Company ${tripletexCompanyId}: ${configs.length} configs, tenant=${tenantId}`);

  // Build lookup: tripletexAccountId -> { clientId, configId }
  const set1Lookup = new Map<number, { clientId: string; configId: string }>();
  const set2Configs: (typeof tripletexSyncConfigs.$inferSelect)[] = [];

  for (const c of configs) {
    const set1Ids: number[] = c.set1TripletexAccountIds?.length
      ? c.set1TripletexAccountIds
      : c.set1TripletexAccountId ? [c.set1TripletexAccountId] : [];
    for (const aid of set1Ids) {
      set1Lookup.set(aid, { clientId: c.clientId, configId: c.id });
    }

    const set2Ids: number[] = c.set2TripletexAccountIds?.length
      ? c.set2TripletexAccountIds
      : c.set2TripletexAccountId ? [c.set2TripletexAccountId] : [];
    if (set2Ids.length > 0) {
      set2Configs.push(c);
    }
  }

  // Determine date range from all configs
  const dateFrom = configs.reduce(
    (min, c) => (c.dateFrom < min ? c.dateFrom : min),
    configs[0].dateFrom
  );
  const dateTo = new Date();
  dateTo.setDate(dateTo.getDate() + 30);
  const dateToStr = dateTo.toISOString().split("T")[0];

  // ----- POSTINGS: Bulk fetch ALL for the company (paginated via fetchAllPages) -----
  let totalPostings = 0;

  if (set1Lookup.size > 0) {
    const tPost = Date.now();
    const allPostings = await fetchAllPages<TxPosting>("/ledger/posting", {
      dateFrom,
      dateTo: dateToStr,
      fields: "*,account(*),voucher(*),currency(*)",
    }, tenantId);

    console.log(`[sync-bulk] Company ${tripletexCompanyId}: fetched ${allPostings.length} postings in ${Date.now() - tPost}ms`);

    // Group by clientId using the lookup
    const byClient = new Map<string, TxPosting[]>();
    for (const p of allPostings) {
      const accountId = p.account?.id;
      if (accountId == null) continue;
      const match = set1Lookup.get(accountId);
      if (!match) continue;
      const list = byClient.get(match.clientId) ?? [];
      list.push(p);
      byClient.set(match.clientId, list);
    }

    // Insert per client
    const tInsert = Date.now();
    for (const [clientId, postings] of byClient) {
      const mapped = postings.map((p) => mapPosting(p, null));
      const inserted = await insertTransactionsBatch(clientId, mapped);
      totalPostings += inserted;
    }
    console.log(`[sync-bulk] Company ${tripletexCompanyId}: inserted ${totalPostings} postings in ${Date.now() - tInsert}ms`);

    // Track max posting ID per config for incremental sync
    const maxIdByConfig = new Map<string, number>();
    for (const p of allPostings) {
      const accountId = p.account?.id;
      if (accountId == null) continue;
      const match = set1Lookup.get(accountId);
      if (!match) continue;
      const cur = maxIdByConfig.get(match.configId) ?? 0;
      if (p.id > cur) maxIdByConfig.set(match.configId, p.id);
    }
    for (const [cfgId, maxId] of maxIdByConfig) {
      await db
        .update(tripletexSyncConfigs)
        .set({ lastSyncPostingId: maxId, lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(tripletexSyncConfigs.id, cfgId));
    }
  }

  // ----- BANK TX: Per-account with concurrency (API requires accountId) -----
  let totalBankTx = 0;

  if (set2Configs.length > 0) {
    const BANK_CONCURRENCY = 5;
    let idx = 0;
    async function nextBankSync(): Promise<void> {
      while (idx < set2Configs.length) {
        const config = set2Configs[idx++];
        try {
          const result = await syncBankTransactions(config);
          totalBankTx += result.inserted;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[sync-bulk] Bank tx for config=${config.id.slice(0, 8)} failed: ${msg.slice(0, 200)}`);
        }
      }
    }
    const workers = Array.from(
      { length: Math.min(BANK_CONCURRENCY, set2Configs.length) },
      () => nextBankSync()
    );
    await Promise.all(workers);
  }

  // ----- Update all configs to completed + accountSyncSettings -----
  const now = new Date();
  const successIds = configs.map((c) => c.id);

  await db
    .update(tripletexSyncConfigs)
    .set({ syncStatus: "completed", syncError: null, updatedAt: now })
    .where(
      and(
        inArray(tripletexSyncConfigs.id, successIds),
        eq(tripletexSyncConfigs.syncStatus, "syncing")
      )
    );

  // Update accountSyncSettings with tx counts
  const allAccountIds = configs.flatMap((c) => [
    ...(c.set1TripletexAccountIds ?? []),
    ...(c.set2TripletexAccountIds ?? []),
  ]).filter((id): id is number => id != null);

  if (allAccountIds.length > 0) {
    await db
      .update(accountSyncSettings)
      .set({ lastTxSyncAt: now, updatedAt: now })
      .where(
        and(
          eq(accountSyncSettings.tenantId, tenantId),
          inArray(accountSyncSettings.tripletexAccountId, allAccountIds)
        )
      );
  }

  console.log(`[sync-bulk] Company ${tripletexCompanyId}: done in ${Date.now() - t0}ms`);
  return { postings: totalPostings, bankTx: totalBankTx };
}
