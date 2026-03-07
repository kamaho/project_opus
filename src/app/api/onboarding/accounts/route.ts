import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountSyncSettings, companies } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/accounts
 *
 * Returns all account_sync_settings rows that have NOT been imported yet
 * (clientId IS NULL) for the tenant's companies. Used by the onboarding
 * account selection step.
 */
export const GET = withTenant(async (_req, { tenantId }) => {
  const companyRows = await db
    .select({
      id: companies.id,
      name: companies.name,
      tripletexCompanyId: companies.tripletexCompanyId,
      vismaNxtCompanyNo: companies.vismaNxtCompanyNo,
    })
    .from(companies)
    .where(eq(companies.tenantId, tenantId));

  if (companyRows.length === 0) {
    return NextResponse.json({ companies: [] });
  }

  const companyIds = companyRows.map((c) => c.id);
  const companyMap = new Map(companyRows.map((c) => [c.id, c]));

  const settingsRows = await db
    .select({
      id: accountSyncSettings.id,
      companyId: accountSyncSettings.companyId,
      accountNumber: accountSyncSettings.accountNumber,
      accountName: accountSyncSettings.accountName,
      accountType: accountSyncSettings.accountType,
      balanceIn: accountSyncSettings.balanceIn,
      balanceOut: accountSyncSettings.balanceOut,
    })
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.tenantId, tenantId),
        isNull(accountSyncSettings.clientId),
      ),
    );

  const filtered = settingsRows.filter((s) => companyIds.includes(s.companyId));

  const result = companyRows
    .map((c) => ({
      companyId: c.id,
      companyName: c.name,
      integration: c.tripletexCompanyId != null
        ? "tripletex" as const
        : c.vismaNxtCompanyNo != null
          ? "visma_nxt" as const
          : null,
      tripletexCompanyId: c.tripletexCompanyId,
      accounts: filtered
        .filter((s) => s.companyId === c.id)
        .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
    }))
    .filter((c) => c.accounts.length > 0);

  return NextResponse.json({ companies: result });
});
