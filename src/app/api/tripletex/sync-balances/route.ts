import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, webhookInbox } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/tripletex/sync-balances
 *
 * Phase 1 (accounts) runs inline (~2-3s).
 * Phase 2 (balances) queued via webhook_inbox for Railway Worker.
 */
export const POST = withTenant(async (req, { tenantId }) => {
  const body = await req.json();
  const { companyId, tripletexCompanyId } = body as {
    companyId: string;
    tripletexCompanyId: number;
  };

  if (!companyId || !tripletexCompanyId) {
    return NextResponse.json(
      { error: "companyId and tripletexCompanyId are required" },
      { status: 400 }
    );
  }

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  try {
    const { syncAccountList } = await import("@/lib/tripletex/sync");
    const phase1 = await syncAccountList(tripletexCompanyId, companyId, tenantId);
    console.log(`[tripletex/sync-balances] Phase 1 done: ${phase1.accountCount} accounts in ${phase1.duration}ms`);

    try {
      await db.insert(webhookInbox).values({
        tenantId,
        source: "tripletex",
        eventType: "sync.balances.requested",
        externalId: `balances-${companyId}-${Date.now()}`,
        payload: { companyId, tenantId },
      });
      console.log(`[tripletex/sync-balances] Queued Phase 2 balance sync for Worker`);
    } catch (err) {
      console.error("[tripletex/sync-balances] Failed to queue Phase 2:", err);
    }

    return NextResponse.json({
      status: "ok",
      accountCount: phase1.accountCount,
      message: `${phase1.accountCount} kontoer lagret. Saldoer hentes av Worker i bakgrunnen.`,
    });
  } catch (err) {
    console.error("[tripletex/sync-balances] Phase 1 failed:", err);
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
