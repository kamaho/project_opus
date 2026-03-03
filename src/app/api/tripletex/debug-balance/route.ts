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

  for (const year of [2024, 2025, 2026]) {
    try {
      const raw = await tripletexGet<unknown>("/balance", {
        accountId: acct.tripletexAccountId,
        year,
        fields: "*",
      }, tenantId);
      results[`year_${year}`] = raw;
    } catch (err) {
      results[`year_${year}`] = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json(results);
});
