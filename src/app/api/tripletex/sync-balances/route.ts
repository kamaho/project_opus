import { withTenant } from "@/lib/auth";
import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

  // Run the fast sync in after() so the response returns immediately
  after(async () => {
    try {
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
