import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/tripletex/sync-balances
 *
 * Phase 1 (accounts) + Phase 2 (balances) both run inline.
 * Total time: ~4-5s (account fetch + upsert + balance fetch + update).
 */
const syncBalancesSchema = z.object({
  companyId: z.string().uuid("Må være en gyldig UUID"),
  tripletexCompanyId: z.number().int().positive("Må være et positivt heltall"),
});

export const POST = withTenant(async (req, { tenantId }) => {
  const parsed = syncBalancesSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { companyId, tripletexCompanyId } = parsed.data;

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  try {
    const { syncAccountList, syncBalancesForAccounts } = await import("@/lib/tripletex/sync");

    const phase1 = await syncAccountList(tripletexCompanyId, companyId, tenantId);
    console.log(`[tripletex/sync-balances] Phase 1 done: ${phase1.accountCount} accounts in ${phase1.duration}ms`);

    let balancesUpdated = 0;
    if (phase1.accountCount > 0) {
      const phase2 = await syncBalancesForAccounts(companyId, tenantId);
      balancesUpdated = phase2.balancesUpdated;
      console.log(`[tripletex/sync-balances] Phase 2 done: ${phase2.balancesUpdated} balances in ${phase2.duration}ms`);
    }

    return NextResponse.json({
      status: "ok",
      accountCount: phase1.accountCount,
      balancesUpdated,
      message: `${phase1.accountCount} kontoer og ${balancesUpdated} saldoer oppdatert.`,
    });
  } catch (err) {
    console.error("[tripletex/sync-balances] Sync failed:", err);
    return NextResponse.json(
      { error: "Sync feilet", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});

/**
 * GET /api/tripletex/sync-balances?companyId=X&tripletexCompanyId=Y
 *
 * Diagnostic: runs BOTH phases inline synchronously.
 */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  let companyId = url.searchParams.get("companyId");
  if (companyId === "__none__") companyId = null;
  let txId = url.searchParams.get("tripletexCompanyId");

  if (!companyId || !txId) {
    const companyRows = await db
      .select({ id: companies.id, tripletexCompanyId: companies.tripletexCompanyId })
      .from(companies)
      .where(eq(companies.tenantId, tenantId))
      .limit(1);

    if (companyRows.length === 0) {
      return NextResponse.json({ error: "Ingen selskaper funnet for tenant" }, { status: 404 });
    }

    const c = companyRows[0];
    if (!c.tripletexCompanyId) {
      return NextResponse.json({
        error: "Selskapet har ingen tripletex_company_id. Denne settes normalt av onboarding.",
        companyId: c.id,
        hint: "Sjekk at company-opprettelsen i onboarding setter tripletexCompanyId",
      }, { status: 400 });
    }

    companyId = c.id;
    txId = String(c.tripletexCompanyId);
  } else {
    const [owned] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
      .limit(1);

    if (!owned) {
      return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
    }
  }

  try {
    const { syncAccountList, syncBalancesForAccounts } = await import("@/lib/tripletex/sync");
    const phase1 = await syncAccountList(Number(txId), companyId, tenantId);
    const phase2 = await syncBalancesForAccounts(companyId, tenantId);

    return NextResponse.json({
      status: "ok",
      phase1,
      phase2,
      message: `${phase1.accountCount} kontoer, ${phase2.balancesUpdated} saldoer oppdatert.`,
    });
  } catch (err) {
    console.error("[tripletex/sync-balances] Diagnostic failed:", err);
    return NextResponse.json({
      error: "Sync feilet",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
    }, { status: 500 });
  }
});
