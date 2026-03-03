import { withTenant } from "@/lib/auth";
import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/tripletex/sync-balances
 *
 * Level 1 sync: fetches chart of accounts + balances for all accounts
 * in a Tripletex company. Fast operation (~3-5 seconds).
 *
 * Used by the simplified onboarding flow — no clients or transaction sync.
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

  after(async () => {
    try {
      console.log(`[tripletex/sync-balances] Starting sync for company=${companyId} tripletex=${tripletexCompanyId} tenant=${tenantId}`);
      const { syncAccountsAndBalances } = await import(
        "@/lib/tripletex/sync"
      );
      const result = await syncAccountsAndBalances(
        tripletexCompanyId,
        companyId,
        tenantId
      );
      console.log(
        `[tripletex/sync-balances] Done: ${result.accountCount} accounts, ${result.balancesUpdated} balances in ${result.duration}ms`
      );
    } catch (err) {
      console.error("[tripletex/sync-balances] Failed:", err);
    }
  });

  return NextResponse.json(
    { status: "syncing", message: "Kontoliste og saldoer synkroniseres" },
    { status: 202 }
  );
});

/**
 * GET /api/tripletex/sync-balances?companyId=X&tripletexCompanyId=Y
 *
 * Diagnostic: runs sync synchronously and returns result/error.
 */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  const tripletexCompanyId = url.searchParams.get("tripletexCompanyId");

  if (!companyId || !tripletexCompanyId) {
    // If no params, look up from DB
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

    try {
      const { syncAccountsAndBalances } = await import("@/lib/tripletex/sync");
      const result = await syncAccountsAndBalances(
        Number(c.tripletexCompanyId),
        c.id,
        tenantId
      );
      return NextResponse.json({ status: "ok", result });
    } catch (err) {
      console.error("[tripletex/sync-balances] Diagnostic failed:", err);
      return NextResponse.json({
        error: "Sync feilet",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
      }, { status: 500 });
    }
  }

  try {
    const { syncAccountsAndBalances } = await import("@/lib/tripletex/sync");
    const result = await syncAccountsAndBalances(
      Number(tripletexCompanyId),
      companyId,
      tenantId
    );
    return NextResponse.json({ status: "ok", result });
  } catch (err) {
    console.error("[tripletex/sync-balances] Diagnostic failed:", err);
    return NextResponse.json({
      error: "Sync feilet",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
    }, { status: 500 });
  }
});
