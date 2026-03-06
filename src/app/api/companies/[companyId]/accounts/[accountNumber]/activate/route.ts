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
 * Supports both Tripletex and Visma NXT companies.
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
  const { dateFrom, syncLevel: requestedLevel } = body as {
    dateFrom?: string;
    syncLevel?: "balance_only" | "transactions";
  };
  const syncLevel = requestedLevel ?? "balance_only";

  const [company] = await db
    .select({
      id: companies.id,
      tripletexCompanyId: companies.tripletexCompanyId,
      vismaNxtCompanyNo: companies.vismaNxtCompanyNo,
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  const integration: "tripletex" | "visma_nxt" | null =
    company.tripletexCompanyId != null
      ? "tripletex"
      : company.vismaNxtCompanyNo != null
        ? "visma_nxt"
        : null;

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

  if (acctSetting.clientId && acctSetting.syncLevel === syncLevel) {
    return NextResponse.json({
      clientId: acctSetting.clientId,
      status: "already_active",
    });
  }
  if (acctSetting.clientId && acctSetting.syncLevel === "transactions") {
    return NextResponse.json({
      clientId: acctSetting.clientId,
      status: "already_active",
    });
  }

  const resolvedDateFrom =
    dateFrom ?? `${new Date().getFullYear()}-01-01`;

  if (acctSetting.clientId && acctSetting.syncLevel === "balance_only" && syncLevel === "transactions") {
    if (!integration) {
      return NextResponse.json(
        { error: "Selskapet er ikke koblet til et regnskapssystem" },
        { status: 400 }
      );
    }

    let configId: string | undefined;

    if (integration === "tripletex" && company.tripletexCompanyId) {
      const configRows = await db.execute<{ id: string }>(sql`
        INSERT INTO tripletex_sync_configs (
          client_id, tenant_id, tripletex_company_id,
          set1_tripletex_account_id, set1_tripletex_account_ids,
          date_from, sync_status, is_active
        ) VALUES (
          ${acctSetting.clientId}, ${tenantId}, ${company.tripletexCompanyId},
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
      configId = Array.from(configRows)[0]?.id;
    } else if (integration === "visma_nxt" && company.vismaNxtCompanyNo) {
      const accountId = acctSetting.vismaNxtAccountId;
      const configRows = await db.execute<{ id: string }>(sql`
        INSERT INTO visma_nxt_sync_configs (
          client_id, tenant_id, visma_company_no,
          set1_account_ids,
          date_from, sync_status, is_active
        ) VALUES (
          ${acctSetting.clientId}, ${tenantId}, ${company.vismaNxtCompanyNo},
          ${JSON.stringify(accountId != null ? [accountId] : [])}::jsonb,
          ${resolvedDateFrom}, 'pending', true
        )
        ON CONFLICT (client_id) DO UPDATE SET
          set1_account_ids = ${JSON.stringify(accountId != null ? [accountId] : [])}::jsonb,
          date_from = ${resolvedDateFrom},
          sync_status = 'pending',
          is_active = true,
          updated_at = now()
        RETURNING id
      `);
      configId = Array.from(configRows)[0]?.id;
    }

    await db
      .update(accountSyncSettings)
      .set({ syncLevel: "transactions", updatedAt: new Date() })
      .where(eq(accountSyncSettings.id, acctSetting.id));

    if (configId) {
      try {
        await db.insert(webhookInbox).values({
          tenantId,
          source: integration,
          eventType: "sync.account.activated",
          externalId: configId,
          payload: { configId, clientId: acctSetting.clientId, accountNumber },
        });
      } catch { /* cron fallback */ }
    }

    return NextResponse.json(
      { clientId: acctSetting.clientId, configId, status: "upgraded" },
      { status: 200 }
    );
  }

  const isBankAccount = acctSetting.accountType === "bank";
  const accountType = isBankAccount ? "bank" : "ledger";
  const counterType = isBankAccount ? "ledger" : "bank";

  const result = await db.transaction(async (tx) => {
    const integrationCol =
      integration === "tripletex"
        ? sql`, tripletex_account_id`
        : integration === "visma_nxt"
          ? sql`, visma_nxt_account_id`
          : sql``;
    const integrationVal =
      integration === "tripletex"
        ? sql`, ${acctSetting.tripletexAccountId}`
        : integration === "visma_nxt"
          ? sql`, ${acctSetting.vismaNxtAccountId}`
          : sql``;
    const integrationUpdate =
      integration === "tripletex"
        ? sql`tripletex_account_id = EXCLUDED.tripletex_account_id`
        : integration === "visma_nxt"
          ? sql`visma_nxt_account_id = EXCLUDED.visma_nxt_account_id`
          : sql`name = EXCLUDED.name`;

    const acct1Rows = await tx.execute<{ id: string }>(sql`
      INSERT INTO accounts (company_id, account_number, name, account_type ${integrationCol})
      VALUES (${companyId}, ${accountNumber}, ${acctSetting.accountName}, ${accountType} ${integrationVal})
      ON CONFLICT (company_id, account_number, account_type) DO UPDATE SET
        name = EXCLUDED.name, ${integrationUpdate}
      RETURNING id
    `);
    const acct1Id = Array.from(acct1Rows)[0]?.id;

    const acct2Rows = await tx.execute<{ id: string }>(sql`
      INSERT INTO accounts (company_id, account_number, name, account_type)
      VALUES (${companyId}, ${accountNumber}, ${`${acctSetting.accountName} (motkonto)`}, ${counterType})
      ON CONFLICT (company_id, account_number, account_type) DO UPDATE SET
        name = EXCLUDED.name
      RETURNING id
    `);
    const acct2Id = Array.from(acct2Rows)[0]?.id;

    if (!acct1Id || !acct2Id) throw new Error("Failed to create accounts");

    const clientName = `${accountNumber} ${acctSetting.accountName}`;
    const clientRows = await tx.execute<{ id: string }>(sql`
      INSERT INTO clients (company_id, name, set1_account_id, set2_account_id, opening_balance_set1, opening_balance_date)
      VALUES (${companyId}, ${clientName}, ${acct1Id}, ${acct2Id}, ${acctSetting.balanceIn ?? "0"}, ${resolvedDateFrom})
      RETURNING id
    `);
    const clientId = Array.from(clientRows)[0]?.id;
    if (!clientId) throw new Error("Failed to create client");

    let configId: string | null = null;

    if (syncLevel === "transactions") {
      if (integration === "tripletex" && company.tripletexCompanyId) {
        const configRows = await tx.execute<{ id: string }>(sql`
          INSERT INTO tripletex_sync_configs (
            client_id, tenant_id, tripletex_company_id,
            set1_tripletex_account_id, set1_tripletex_account_ids,
            date_from, sync_status, is_active
          ) VALUES (
            ${clientId}, ${tenantId}, ${company.tripletexCompanyId},
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
        configId = Array.from(configRows)[0]?.id ?? null;
      } else if (integration === "visma_nxt" && company.vismaNxtCompanyNo) {
        const accountId = acctSetting.vismaNxtAccountId;
        const configRows = await tx.execute<{ id: string }>(sql`
          INSERT INTO visma_nxt_sync_configs (
            client_id, tenant_id, visma_company_no,
            set1_account_ids,
            date_from, sync_status, is_active
          ) VALUES (
            ${clientId}, ${tenantId}, ${company.vismaNxtCompanyNo},
            ${JSON.stringify(accountId != null ? [accountId] : [])}::jsonb,
            ${resolvedDateFrom}, 'pending', true
          )
          ON CONFLICT (client_id) DO UPDATE SET
            set1_account_ids = ${JSON.stringify(accountId != null ? [accountId] : [])}::jsonb,
            date_from = ${resolvedDateFrom},
            sync_status = 'pending',
            is_active = true,
            updated_at = now()
          RETURNING id
        `);
        configId = Array.from(configRows)[0]?.id ?? null;
      }
    }

    await tx
      .update(accountSyncSettings)
      .set({
        syncLevel,
        clientId,
        activatedAt: new Date(),
        activatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(accountSyncSettings.id, acctSetting.id));

    return { clientId, configId };
  });

  if (syncLevel === "transactions") {
    try {
      const { seedStandardRules } = await import("@/lib/matching/seed-rules");
      await seedStandardRules(result.clientId, tenantId);
    } catch { /* non-fatal */ }

    if (result.configId && integration) {
      try {
        await db.insert(webhookInbox).values({
          tenantId,
          source: integration,
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
    }
  }

  return NextResponse.json(
    {
      clientId: result.clientId,
      configId: result.configId,
      status: syncLevel === "transactions" ? "syncing" : "activated",
    },
    { status: 201 }
  );
});
