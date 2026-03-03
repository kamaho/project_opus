import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { tripletexGet } from "@/lib/tripletex";
import { db } from "@/lib/db";
import { accountSyncSettings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/tripletex/debug-balance?accountNumber=1000
 *
 * Diagnostic: calls Tripletex /balance API directly for a single account
 * with years 2024, 2025, 2026 to find which one returns data.
 */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const accountNumber = url.searchParams.get("accountNumber") ?? "1000";

  const [acct] = await db
    .select({
      tripletexAccountId: accountSyncSettings.tripletexAccountId,
      accountNumber: accountSyncSettings.accountNumber,
      accountName: accountSyncSettings.accountName,
    })
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.tenantId, tenantId),
        eq(accountSyncSettings.accountNumber, accountNumber),
      )
    )
    .limit(1);

  if (!acct) {
    return NextResponse.json({ error: `Account ${accountNumber} not found` }, { status: 404 });
  }

  const results: Record<string, unknown> = {
    account: acct,
  };

  const year = 2026;
  const tests: Array<{ name: string; path: string; params: Record<string, string | number | boolean> }> = [
    { name: "balance_query", path: "/balance", params: { accountId: acct.tripletexAccountId, year, fields: "*" } },
    { name: "balance_id", path: `/balance/${acct.tripletexAccountId}`, params: { year, fields: "*" } },
    { name: "ledger_account_fields", path: "/ledger/account", params: { id: acct.tripletexAccountId, fields: "id,number,name,openingBalance,closingBalance,balanceIn,balanceOut" } },
    { name: "ledger_account_id", path: `/ledger/account/${acct.tripletexAccountId}`, params: { fields: "*" } },
    { name: "balance_sheet", path: "/balanceSheet", params: { accountNumberFrom: acct.accountNumber, accountNumberTo: acct.accountNumber, fields: "*" } },
    { name: "ledger_posting_openPost", path: "/ledger/posting/openPost", params: { accountId: acct.tripletexAccountId, fields: "*", count: 1 } },
  ];

  for (const ep of tests) {
    try {
      const raw = await tripletexGet<unknown>(ep.path, ep.params, tenantId);
      results[ep.name] = raw;
    } catch (err) {
      results[ep.name] = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json(results);
});
