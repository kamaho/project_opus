import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  accountSyncSettings,
  companies,
  webhookInbox,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

export const dynamic = "force-dynamic";

const MAX_BULK_ACTIVATE = 20;

/**
 * POST /api/companies/[companyId]/accounts/bulk-activate
 *
 * Activates transaction sync for multiple accounts at once (max 20).
 * Creates clients + sync-configs and queues Worker jobs.
 */
export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  const companyId = params?.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const bulkSchema = z.object({
    accountNumbers: z
      .array(z.string().min(1, "Kontonummer kan ikke være tomt"))
      .min(1, "Minst ett kontonummer er påkrevd")
      .max(MAX_BULK_ACTIVATE, `Maks ${MAX_BULK_ACTIVATE} kontoer per gang`),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Må være YYYY-MM-DD").optional(),
    syncLevel: z.enum(["balance_only", "transactions"], { message: "Må være 'balance_only' eller 'transactions'" }).default("balance_only"),
  });

  const parsed = bulkSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { accountNumbers, dateFrom, syncLevel } = parsed.data;

  const [company] = await db
    .select({
      id: companies.id,
      tripletexCompanyId: companies.tripletexCompanyId,
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company || !company.tripletexCompanyId) {
    return NextResponse.json(
      { error: "Selskap ikke funnet eller ikke koblet til Tripletex" },
      { status: 404 }
    );
  }

  const settings = await db
    .select()
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.companyId, companyId),
        eq(accountSyncSettings.tenantId, tenantId),
        inArray(accountSyncSettings.accountNumber, accountNumbers)
      )
    );

  const resolvedDateFrom = dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const results: Array<{
    accountNumber: string;
    status: "activated" | "already_active" | "error";
    clientId?: string;
    error?: string;
  }> = [];

  for (const setting of settings) {
    if (setting.clientId && (setting.syncLevel === syncLevel || setting.syncLevel === "transactions")) {
      results.push({
        accountNumber: setting.accountNumber,
        status: "already_active",
        clientId: setting.clientId,
      });
      continue;
    }

    try {
      const isBankAccount = setting.accountType === "bank";
      const accountType = isBankAccount ? "bank" : "ledger";
      const counterType = isBankAccount ? "ledger" : "bank";

      // Upgrade path: balance_only → transactions
      if (setting.clientId && setting.syncLevel === "balance_only" && syncLevel === "transactions") {
        const configRows = await db.execute<{ id: string }>(sql`
          INSERT INTO tripletex_sync_configs (
            client_id, tenant_id, tripletex_company_id,
            set1_tripletex_account_id, set1_tripletex_account_ids,
            date_from, sync_status, is_active
          ) VALUES (
            ${setting.clientId}, ${tenantId}, ${company.tripletexCompanyId},
            ${setting.tripletexAccountId},
            ${JSON.stringify([setting.tripletexAccountId])}::jsonb,
            ${resolvedDateFrom}, 'pending', true
          )
          ON CONFLICT (client_id) DO UPDATE SET
            set1_tripletex_account_id = ${setting.tripletexAccountId},
            set1_tripletex_account_ids = ${JSON.stringify([setting.tripletexAccountId])}::jsonb,
            date_from = ${resolvedDateFrom},
            sync_status = 'pending',
            is_active = true,
            updated_at = now()
          RETURNING id
        `);
        const cfgId = Array.from(configRows)[0]?.id;

        await db
          .update(accountSyncSettings)
          .set({ syncLevel: "transactions", updatedAt: new Date() })
          .where(eq(accountSyncSettings.id, setting.id));

        if (cfgId) {
          try {
            await db.insert(webhookInbox).values({
              tenantId,
              source: "tripletex",
              eventType: "sync.account.activated",
              externalId: cfgId,
              payload: { configId: cfgId, clientId: setting.clientId, accountNumber: setting.accountNumber },
            });
          } catch { /* cron fallback */ }
        }

        results.push({ accountNumber: setting.accountNumber, status: "activated", clientId: setting.clientId });
        continue;
      }

      // New activation
      const { clientId, configId } = await db.transaction(async (tx) => {
        const acct1Rows = await tx.execute<{ id: string }>(sql`
          INSERT INTO accounts (company_id, account_number, name, account_type, tripletex_account_id)
          VALUES (${companyId}, ${setting.accountNumber}, ${setting.accountName}, ${accountType}, ${setting.tripletexAccountId})
          ON CONFLICT (company_id, account_number, account_type) DO UPDATE SET
            name = EXCLUDED.name, tripletex_account_id = EXCLUDED.tripletex_account_id
          RETURNING id
        `);
        const acct1Id = Array.from(acct1Rows)[0]?.id;

        const acct2Rows = await tx.execute<{ id: string }>(sql`
          INSERT INTO accounts (company_id, account_number, name, account_type)
          VALUES (${companyId}, ${setting.accountNumber}, ${`${setting.accountName} (motkonto)`}, ${counterType})
          ON CONFLICT (company_id, account_number, account_type) DO UPDATE SET
            name = EXCLUDED.name
          RETURNING id
        `);
        const acct2Id = Array.from(acct2Rows)[0]?.id;

        if (!acct1Id || !acct2Id) throw new Error("Failed to create accounts");

        const clientName = `${setting.accountNumber} ${setting.accountName}`;
        const clientRows = await tx.execute<{ id: string }>(sql`
          INSERT INTO clients (company_id, name, set1_account_id, set2_account_id, opening_balance_set1, opening_balance_date)
          VALUES (${companyId}, ${clientName}, ${acct1Id}, ${acct2Id}, ${setting.balanceIn ?? "0"}, ${resolvedDateFrom})
          RETURNING id
        `);
        const cId = Array.from(clientRows)[0]?.id;
        if (!cId) throw new Error("Failed to create client");

        let cfgId: string | null = null;

        if (syncLevel === "transactions" && company.tripletexCompanyId) {
          const configRows = await tx.execute<{ id: string }>(sql`
            INSERT INTO tripletex_sync_configs (
              client_id, tenant_id, tripletex_company_id,
              set1_tripletex_account_id, set1_tripletex_account_ids,
              date_from, sync_status, is_active
            ) VALUES (
              ${cId}, ${tenantId}, ${company.tripletexCompanyId},
              ${setting.tripletexAccountId},
              ${JSON.stringify([setting.tripletexAccountId])}::jsonb,
              ${resolvedDateFrom}, 'pending', true
            )
            ON CONFLICT (client_id) DO UPDATE SET
              set1_tripletex_account_id = ${setting.tripletexAccountId},
              set1_tripletex_account_ids = ${JSON.stringify([setting.tripletexAccountId])}::jsonb,
              date_from = ${resolvedDateFrom},
              sync_status = 'pending',
              is_active = true,
              updated_at = now()
            RETURNING id
          `);
          cfgId = Array.from(configRows)[0]?.id ?? null;
        }

        await tx
          .update(accountSyncSettings)
          .set({
            syncLevel,
            clientId: cId,
            activatedAt: new Date(),
            activatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(accountSyncSettings.id, setting.id));

        return { clientId: cId, configId: cfgId };
      });

      if (syncLevel === "transactions") {
        try {
          const { seedStandardRules } = await import("@/lib/matching/seed-rules");
          await seedStandardRules(clientId, tenantId);
        } catch { /* non-fatal */ }

        if (configId) {
          try {
            await db.insert(webhookInbox).values({
              tenantId,
              source: "tripletex",
              eventType: "sync.account.activated",
              externalId: configId,
              payload: { configId, clientId, accountNumber: setting.accountNumber },
            });
          } catch { /* cron fallback */ }
        }
      }

      results.push({
        accountNumber: setting.accountNumber,
        status: "activated",
        clientId,
      });
    } catch (err) {
      results.push({
        accountNumber: setting.accountNumber,
        status: "error",
        error: err instanceof Error ? err.message : "Ukjent feil",
      });
    }
  }

  const notFound = accountNumbers.filter(
    (n) => !settings.some((s) => s.accountNumber === n)
  );
  for (const n of notFound) {
    results.push({ accountNumber: n, status: "error", error: "Konto ikke funnet" });
  }

  return NextResponse.json({ results });
});
