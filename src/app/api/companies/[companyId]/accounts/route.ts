import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountSyncSettings, companies } from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/companies/[companyId]/accounts
 * Returns all accounts with balance/sync data from account_sync_settings.
 * Activated accounts (sync_level = "transactions") are sorted first.
 */
export const GET = withTenant(async (_req, { tenantId }, params) => {
  const companyId = params?.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.companyId, companyId),
        eq(accountSyncSettings.tenantId, tenantId)
      )
    )
    .orderBy(
      desc(accountSyncSettings.syncLevel),
      asc(accountSyncSettings.accountNumber)
    );

  return NextResponse.json(rows);
});
