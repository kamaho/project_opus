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

  const year = new Date().getFullYear();
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;

  const tests: Array<{ name: string; path: string; params: Record<string, string | number | boolean> }> = [
    {
      name: "balanceSheet_single",
      path: "/balanceSheet",
      params: { dateFrom, dateTo, accountNumberFrom: acct.accountNumber, accountNumberTo: acct.accountNumber, fields: "*" },
    },
    {
      name: "balanceSheet_all_1000_1999",
      path: "/balanceSheet",
      params: { dateFrom, dateTo, accountNumberFrom: "1000", accountNumberTo: "1999", fields: "*" },
    },
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
