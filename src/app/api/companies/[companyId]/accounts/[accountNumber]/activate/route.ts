import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  accountSyncSettings,
  companies,
  webhookInbox,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/companies/[companyId]/accounts/[accountNumber]/activate
 *
 * Activates transaction-level sync for an account:
 * 1. Creates a client + accounts + sync-config
 * 2. Updates account_sync_settings to sync_level = "transactions"
 * 3. Queues a Worker job to fetch transactions
 */
export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  const companyId = params?.companyId;
  const accountNumber = params?.accountNumber;

  if (!companyId || !accountNumber) {
    return NextResponse.json(
      { error: "companyId and accountNumber required" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { dateFrom } = body as { dateFrom?: string };

  const [company] = await db
    .select({
      id: companies.id,
      tripletexCompanyId: companies.tripletexCompanyId,
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  const [acctSetting] = await db
    .select()
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.companyId, companyId),
        eq(accountSyncSettings.accountNumber, accountNumber),
        eq(accountSyncSettings.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!acctSetting) {
    return NextResponse.json(
      { error: "Konto ikke funnet. Kjør saldo-sync først." },
      { status: 404 }
    );
  }

  if (acctSetting.syncLevel === "transactions" && acctSetting.clientId) {
    return NextResponse.json({
      clientId: acctSetting.clientId,
      status: "already_active",
    });
  }

  const resolvedDateFrom =
    dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const tripletexCompanyId = company.tripletexCompanyId;

  if (!tripletexCompanyId) {
    return NextResponse.json(
      { error: "Selskapet er ikke koblet til Tripletex" },
      { status: 400 }
    );
  }

  const isBankAccount = acctSetting.accountType === "bank";
  const accountType = isBankAccount ? "bank" : "ledger";
  const counterType = isBankAccount ? "ledger" : "bank";

  const result = await db.transaction(async (tx) => {
    // Create two account rows (set 1 + set 2)
    const acct1Rows = await tx.execute<{ id: string }>(sql`
      INSERT INTO accounts (company_id, account_number, name, account_type, tripletex_account_id)
      VALUES (${companyId}, ${accountNumber}, ${acctSetting.accountName}, ${accountType}, ${acctSetting.tripletexAccountId})
      RETURNING id
    `);
    const acct1Id = Array.from(acct1Rows)[0]?.id;

    const acct2Rows = await tx.execute<{ id: string }>(sql`
      INSERT INTO accounts (company_id, account_number, name, account_type)
      VALUES (${companyId}, ${accountNumber}, ${`${acctSetting.accountName} (motkonto)`}, ${counterType})
      RETURNING id
    `);
    const acct2Id = Array.from(acct2Rows)[0]?.id;

    if (!acct1Id || !acct2Id) throw new Error("Failed to create accounts");

    // Create client
    const clientName = `${accountNumber} ${acctSetting.accountName}`;
    const clientRows = await tx.execute<{ id: string }>(sql`
      INSERT INTO clients (company_id, name, set1_account_id, set2_account_id, opening_balance_set1, opening_balance_date)
      VALUES (${companyId}, ${clientName}, ${acct1Id}, ${acct2Id}, ${acctSetting.balanceIn ?? "0"}, ${resolvedDateFrom})
      RETURNING id
    `);
    const clientId = Array.from(clientRows)[0]?.id;
    if (!clientId) throw new Error("Failed to create client");

    // Create sync config
    const configRows = await tx.execute<{ id: string }>(sql`
      INSERT INTO tripletex_sync_configs (
        client_id, tenant_id, tripletex_company_id,
        set1_tripletex_account_id, set1_tripletex_account_ids,
        date_from, sync_status, is_active
      ) VALUES (
        ${clientId}, ${tenantId}, ${tripletexCompanyId},
        ${acctSetting.tripletexAccountId},
        ${JSON.stringify([acctSetting.tripletexAccountId])}::jsonb,
        ${resolvedDateFrom}, 'pending', true
      )
      ON CONFLICT (client_id) DO UPDATE SET
        set1_tripletex_account_id = ${acctSetting.tripletexAccountId},
        set1_tripletex_account_ids = ${JSON.stringify([acctSetting.tripletexAccountId])}::jsonb,
        date_from = ${resolvedDateFrom},
        sync_status = 'pending',
        is_active = true,
        updated_at = now()
      RETURNING id
    `);
    const configId = Array.from(configRows)[0]?.id;
    if (!configId) throw new Error("Failed to create sync config");

    // Update account_sync_settings
    await tx
      .update(accountSyncSettings)
      .set({
        syncLevel: "transactions",
        clientId,
        activatedAt: new Date(),
        activatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(accountSyncSettings.id, acctSetting.id));

    return { clientId, configId };
  });

  // Seed default matching rules (outside tx — uses its own db connection)
  try {
    const { seedStandardRules } = await import("@/lib/matching/seed-rules");
    await seedStandardRules(result.clientId, tenantId);
  } catch {
    // non-fatal
  }

  // Queue Worker job outside transaction
  try {
    await db.insert(webhookInbox).values({
      tenantId,
      source: "tripletex",
      eventType: "sync.account.activated",
      externalId: result.configId,
      payload: {
        configId: result.configId,
        clientId: result.clientId,
        accountNumber,
      },
    });
  } catch (err) {
    console.error(
      `[activate] Failed to queue sync job for config=${result.configId}:`,
      err
    );
  }

  return NextResponse.json(
    { clientId: result.clientId, configId: result.configId, status: "syncing" },
    { status: 201 }
  );
});
