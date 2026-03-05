import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getCompanyNo } from "@/lib/visma-nxt/auth";
import {
  syncCompany,
  syncAccountList,
  syncBalancesForAccounts,
} from "@/lib/visma-nxt/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/visma-nxt/sync
 *
 * Runs initial sync: company → chart of accounts → balances.
 * Requires an active Visma NXT connection with a companyNo set.
 */
export const POST = withTenant(async (_req, { tenantId }) => {
  const t0 = Date.now();

  let companyNo: number;
  try {
    companyNo = await getCompanyNo(tenantId);
  } catch {
    return NextResponse.json(
      { error: "Ingen Visma NXT-tilkobling funnet. Koble til først." },
      { status: 400 }
    );
  }

  try {
    const companyId = await syncCompany(companyNo, tenantId);
    const accountResult = await syncAccountList(companyNo, companyId, tenantId);

    let balancesUpdated = 0;
    try {
      const balanceResult = await syncBalancesForAccounts(companyNo, companyId, tenantId);
      balancesUpdated = balanceResult.balancesUpdated;
    } catch (err) {
      console.warn("[visma-nxt/sync] Balance sync failed (non-fatal):", err);
    }

    return NextResponse.json({
      ok: true,
      companyId,
      accounts: accountResult.accountCount,
      balancesUpdated,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[visma-nxt/sync] Sync failed:", msg);
    return NextResponse.json(
      { error: `Synkronisering feilet: ${msg.slice(0, 300)}` },
      { status: 500 }
    );
  }
});
