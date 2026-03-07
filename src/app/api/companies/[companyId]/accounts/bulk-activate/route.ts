import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  accounts,
  accountSyncSettings,
  clients,
  companies,
  matchingRules,
  tripletexSyncConfigs,
  vismaNxtSyncConfigs,
  webhookInbox,
} from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

export const dynamic = "force-dynamic";

const MAX_BULK_ACTIVATE = 100;

const STANDARD_RULES = [
  { name: "1:1 med lik dato", priority: 1, ruleType: "one_to_one" as const, isInternal: false, dateMustMatch: true, dateToleranceDays: 0 },
  { name: "1:1 uten datokrav", priority: 2, ruleType: "one_to_one" as const, isInternal: false, dateMustMatch: false, dateToleranceDays: 0 },
  { name: "Intern 1:1 med lik dato", priority: 3, ruleType: "one_to_one" as const, isInternal: true, dateMustMatch: true, dateToleranceDays: 0 },
  { name: "Intern 1:1 uten datokrav", priority: 4, ruleType: "one_to_one" as const, isInternal: true, dateMustMatch: false, dateToleranceDays: 0 },
  { name: "Mange:1 med lik dato", priority: 5, ruleType: "many_to_one" as const, isInternal: false, dateMustMatch: true, dateToleranceDays: 0 },
  { name: "Mange:1 uten datokrav", priority: 6, ruleType: "many_to_one" as const, isInternal: false, dateMustMatch: false, dateToleranceDays: 0 },
  { name: "Intern Mange:1 med lik dato", priority: 7, ruleType: "many_to_one" as const, isInternal: true, dateMustMatch: true, dateToleranceDays: 0 },
  { name: "Intern Mange:1 uten datokrav", priority: 8, ruleType: "many_to_one" as const, isInternal: true, dateMustMatch: false, dateToleranceDays: 0 },
  { name: "Mange:Mange med lik dato", priority: 9, ruleType: "many_to_many" as const, isInternal: false, dateMustMatch: true, dateToleranceDays: 0 },
  { name: "Mange:Mange uten datokrav", priority: 10, ruleType: "many_to_many" as const, isInternal: false, dateMustMatch: false, dateToleranceDays: 0 },
];

/**
 * POST /api/companies/[companyId]/accounts/bulk-activate
 *
 * Activates sync for up to 100 accounts using bulk SQL (8 statements
 * instead of N×8 sequential ones). Supports Tripletex and Visma NXT.
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
    syncLevel: z.enum(["balance_only", "transactions"]).default("balance_only"),
  });

  const parsed = bulkSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { accountNumbers, dateFrom, syncLevel } = parsed.data;

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

  if (!integration) {
    return NextResponse.json(
      { error: "Selskapet er ikke koblet til et regnskapssystem" },
      { status: 400 },
    );
  }

  // ── 1. Fetch all relevant settings in ONE query ──────────────────────
  const allSettings = await db
    .select()
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.companyId, companyId),
        eq(accountSyncSettings.tenantId, tenantId),
        inArray(accountSyncSettings.accountNumber, accountNumbers),
      ),
    );

  const resolvedDateFrom = dateFrom ?? `${new Date().getFullYear()}-01-01`;
  const allConfigIds: string[] = [];
  const results: Array<{
    accountNumber: string;
    status: "activated" | "already_active" | "error";
    clientId?: string;
    error?: string;
  }> = [];

  // ── 2. Classify into three groups ────────────────────────────────────
  type Setting = (typeof allSettings)[number];
  const alreadyActive: Setting[] = [];
  const toUpgrade: Setting[] = [];
  const toCreate: Setting[] = [];

  for (const s of allSettings) {
    if (s.clientId && (s.syncLevel === syncLevel || s.syncLevel === "transactions")) {
      alreadyActive.push(s);
    } else if (s.clientId && s.syncLevel === "balance_only" && syncLevel === "transactions") {
      toUpgrade.push(s);
    } else {
      toCreate.push(s);
    }
  }

  for (const s of alreadyActive) {
    results.push({ accountNumber: s.accountNumber, status: "already_active", clientId: s.clientId! });
  }

  // ── 3. Bulk UPGRADE: existing client, balance_only → transactions ───
  if (toUpgrade.length > 0 && syncLevel === "transactions") {
    try {
      if (integration === "tripletex" && company.tripletexCompanyId) {
        const cfgValues = toUpgrade.map((s) => ({
          clientId: s.clientId!,
          tenantId,
          tripletexCompanyId: company.tripletexCompanyId!,
          set1TripletexAccountId: s.tripletexAccountId,
          set1TripletexAccountIds: s.tripletexAccountId ? [s.tripletexAccountId] : [],
          dateFrom: resolvedDateFrom,
          syncStatus: "pending" as const,
          isActive: true,
        }));
        const cfgRows = await db
          .insert(tripletexSyncConfigs)
          .values(cfgValues)
          .onConflictDoUpdate({
            target: [tripletexSyncConfigs.clientId],
            set: {
              set1TripletexAccountId: sql`excluded.set1_tripletex_account_id`,
              set1TripletexAccountIds: sql`excluded.set1_tripletex_account_ids`,
              dateFrom: sql`excluded.date_from`,
              syncStatus: sql`'pending'`,
              isActive: sql`true`,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: tripletexSyncConfigs.id });
        for (const r of cfgRows) allConfigIds.push(r.id);
      } else if (integration === "visma_nxt" && company.vismaNxtCompanyNo) {
        const cfgValues = toUpgrade.map((s) => ({
          clientId: s.clientId!,
          tenantId,
          vismaCompanyNo: company.vismaNxtCompanyNo!,
          set1AccountIds: s.vismaNxtAccountId != null ? [s.vismaNxtAccountId] : [],
          dateFrom: resolvedDateFrom,
          syncStatus: "pending" as const,
          isActive: true,
        }));
        const cfgRows = await db
          .insert(vismaNxtSyncConfigs)
          .values(cfgValues)
          .onConflictDoUpdate({
            target: [vismaNxtSyncConfigs.clientId],
            set: {
              set1AccountIds: sql`excluded.set1_account_ids`,
              dateFrom: sql`excluded.date_from`,
              syncStatus: sql`'pending'`,
              isActive: sql`true`,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: vismaNxtSyncConfigs.id });
        for (const r of cfgRows) allConfigIds.push(r.id);
      }

      await db
        .update(accountSyncSettings)
        .set({ syncLevel: "transactions", updatedAt: new Date() })
        .where(inArray(accountSyncSettings.id, toUpgrade.map((s) => s.id)));

      for (const s of toUpgrade) {
        results.push({ accountNumber: s.accountNumber, status: "activated", clientId: s.clientId! });
      }
    } catch (err) {
      for (const s of toUpgrade) {
        results.push({
          accountNumber: s.accountNumber,
          status: "error",
          error: err instanceof Error ? err.message : "Upgrade feilet",
        });
      }
    }
  }

  // ── 4. Bulk CREATE: new accounts + clients + configs in one tx ───────
  if (toCreate.length > 0) {
    try {
      const clientMap = await db.transaction(async (tx) => {
        // 4a. Bulk INSERT M1 accounts (one statement, N rows)
        const m1Values = toCreate.map((s) => ({
          companyId,
          accountNumber: s.accountNumber,
          name: s.accountName,
          accountType: (s.accountType === "bank" ? "bank" : "ledger") as typeof accounts.$inferInsert.accountType,
          ...(integration === "tripletex"
            ? { tripletexAccountId: s.tripletexAccountId }
            : { vismaNxtAccountId: s.vismaNxtAccountId }),
        }));

        const m1Rows = await tx
          .insert(accounts)
          .values(m1Values)
          .onConflictDoUpdate({
            target: [accounts.companyId, accounts.accountNumber, accounts.accountType],
            set: {
              name: sql`excluded.name`,
              ...(integration === "tripletex"
                ? { tripletexAccountId: sql`excluded.tripletex_account_id` }
                : { vismaNxtAccountId: sql`excluded.visma_nxt_account_id` }),
            },
          })
          .returning({ id: accounts.id, accountNumber: accounts.accountNumber });

        const m1Map = new Map(m1Rows.map((r) => [r.accountNumber, r.id]));

        // 4b. Bulk INSERT M2 accounts (counter-type, one statement)
        const m2Values = toCreate.map((s) => ({
          companyId,
          accountNumber: s.accountNumber,
          name: `${s.accountName} (motkonto)`,
          accountType: (s.accountType === "bank" ? "ledger" : "bank") as typeof accounts.$inferInsert.accountType,
        }));

        const m2Rows = await tx
          .insert(accounts)
          .values(m2Values)
          .onConflictDoUpdate({
            target: [accounts.companyId, accounts.accountNumber, accounts.accountType],
            set: { name: sql`excluded.name` },
          })
          .returning({ id: accounts.id, accountNumber: accounts.accountNumber });

        const m2Map = new Map(m2Rows.map((r) => [r.accountNumber, r.id]));

        // 4c. Bulk INSERT clients using Map-lookup on accountNumber
        const clientValues = toCreate.map((s) => ({
          companyId,
          name: `${s.accountNumber} ${s.accountName}`,
          set1AccountId: m1Map.get(s.accountNumber)!,
          set2AccountId: m2Map.get(s.accountNumber)!,
          openingBalanceSet1: s.balanceIn ?? "0",
          openingBalanceDate: resolvedDateFrom,
        }));

        const clientRows = await tx
          .insert(clients)
          .values(clientValues)
          .returning({ id: clients.id, set1AccountId: clients.set1AccountId });

        // Map back via set1AccountId → m1Map reverse → accountNumber
        const m1Reverse = new Map(Array.from(m1Map.entries()).map(([an, id]) => [id, an]));
        const cMap = new Map<string, string>();
        for (const r of clientRows) {
          const acctNum = m1Reverse.get(r.set1AccountId);
          if (acctNum) cMap.set(acctNum, r.id);
        }

        // 4d. Bulk INSERT sync configs (if transactions level)
        if (syncLevel === "transactions") {
          if (integration === "tripletex" && company.tripletexCompanyId) {
            const cfgValues = toCreate
              .filter((s) => cMap.has(s.accountNumber))
              .map((s) => ({
                clientId: cMap.get(s.accountNumber)!,
                tenantId,
                tripletexCompanyId: company.tripletexCompanyId!,
                set1TripletexAccountId: s.tripletexAccountId,
                set1TripletexAccountIds: s.tripletexAccountId ? [s.tripletexAccountId] : [],
                dateFrom: resolvedDateFrom,
                syncStatus: "pending" as const,
                isActive: true,
              }));

            if (cfgValues.length > 0) {
              const cfgRows = await tx
                .insert(tripletexSyncConfigs)
                .values(cfgValues)
                .onConflictDoUpdate({
                  target: [tripletexSyncConfigs.clientId],
                  set: {
                    set1TripletexAccountId: sql`excluded.set1_tripletex_account_id`,
                    set1TripletexAccountIds: sql`excluded.set1_tripletex_account_ids`,
                    dateFrom: sql`excluded.date_from`,
                    syncStatus: sql`'pending'`,
                    isActive: sql`true`,
                    updatedAt: sql`now()`,
                  },
                })
                .returning({ id: tripletexSyncConfigs.id });
              for (const r of cfgRows) allConfigIds.push(r.id);
            }
          } else if (integration === "visma_nxt" && company.vismaNxtCompanyNo) {
            const cfgValues = toCreate
              .filter((s) => cMap.has(s.accountNumber))
              .map((s) => ({
                clientId: cMap.get(s.accountNumber)!,
                tenantId,
                vismaCompanyNo: company.vismaNxtCompanyNo!,
                set1AccountIds: s.vismaNxtAccountId != null ? [s.vismaNxtAccountId] : [],
                dateFrom: resolvedDateFrom,
                syncStatus: "pending" as const,
                isActive: true,
              }));

            if (cfgValues.length > 0) {
              const cfgRows = await tx
                .insert(vismaNxtSyncConfigs)
                .values(cfgValues)
                .onConflictDoUpdate({
                  target: [vismaNxtSyncConfigs.clientId],
                  set: {
                    set1AccountIds: sql`excluded.set1_account_ids`,
                    dateFrom: sql`excluded.date_from`,
                    syncStatus: sql`'pending'`,
                    isActive: sql`true`,
                    updatedAt: sql`now()`,
                  },
                })
                .returning({ id: vismaNxtSyncConfigs.id });
              for (const r of cfgRows) allConfigIds.push(r.id);
            }
          }
        }

        // 4e. Bulk UPDATE accountSyncSettings with per-row clientId
        const updateTuples = toCreate
          .filter((s) => cMap.has(s.accountNumber))
          .map((s) =>
            sql`(${s.id}::uuid, ${syncLevel}::text, ${cMap.get(s.accountNumber)!}::uuid, ${userId ?? "system"}::text)`,
          );

        if (updateTuples.length > 0) {
          await tx.execute(sql`
            UPDATE account_sync_settings AS ass
            SET
              sync_level = v.sl,
              client_id = v.cid,
              activated_at = now(),
              activated_by = v.aby,
              updated_at = now()
            FROM (VALUES ${sql.join(updateTuples, sql`, `)}) AS v(id, sl, cid, aby)
            WHERE ass.id = v.id
          `);
        }

        return cMap;
      });

      // 4f. Bulk INSERT matching rules (outside tx — non-fatal)
      if (syncLevel === "transactions" && clientMap.size > 0) {
        try {
          const ruleValues = Array.from(clientMap.values()).flatMap((cId) =>
            STANDARD_RULES.map((r) => ({
              clientId: cId,
              tenantId,
              ...r,
              compareCurrency: "local" as const,
              allowTolerance: false,
              toleranceAmount: "0",
              conditions: [],
              isActive: !r.isInternal,
            })),
          );
          if (ruleValues.length > 0) {
            await db.insert(matchingRules).values(ruleValues);
          }
        } catch {
          /* non-fatal — rules can be seeded later */
        }
      }

      for (const s of toCreate) {
        results.push({
          accountNumber: s.accountNumber,
          status: clientMap.has(s.accountNumber) ? "activated" : "error",
          clientId: clientMap.get(s.accountNumber),
          error: clientMap.has(s.accountNumber) ? undefined : "Opprettelse feilet",
        });
      }
    } catch (err) {
      for (const s of toCreate) {
        results.push({
          accountNumber: s.accountNumber,
          status: "error",
          error: err instanceof Error ? err.message : "Ukjent feil",
        });
      }
    }
  }

  // ── 5. Queue ONE webhook event for all new configs ──────────────────
  if (allConfigIds.length > 0 && integration === "tripletex") {
    try {
      await db.insert(webhookInbox).values({
        tenantId,
        source: integration,
        eventType: "sync.bulk.activated",
        externalId: `${companyId}-${Date.now()}`,
        payload: { configIds: allConfigIds, companyId, tenantId },
      });
    } catch {
      /* sync poller fallback */
    }
  }

  // ── 6. Report accounts not found in settings ────────────────────────
  const notFound = accountNumbers.filter(
    (n) => !allSettings.some((s) => s.accountNumber === n),
  );
  for (const n of notFound) {
    results.push({ accountNumber: n, status: "error", error: "Konto ikke funnet" });
  }

  return NextResponse.json({ results });
});
