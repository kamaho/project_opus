import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  accountSyncSettings,
  companies,
  tripletexSyncConfigs,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/companies/[companyId]/accounts/[accountNumber]/deactivate
 *
 * Deactivates transaction sync for an account.
 * Does NOT delete existing transactions — they are kept for history.
 */
export const POST = withTenant(async (_req, { tenantId }, params) => {
  const companyId = params?.companyId;
  const accountNumber = params?.accountNumber;

  if (!companyId || !accountNumber) {
    return NextResponse.json(
      { error: "companyId and accountNumber required" },
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

  const [acctSetting] = await db
    .select()
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.companyId, companyId),
        eq(accountSyncSettings.accountNumber, accountNumber),
        eq(accountSyncSettings.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!acctSetting) {
    return NextResponse.json({ error: "Konto ikke funnet" }, { status: 404 });
  }

  await db
    .update(accountSyncSettings)
    .set({
      syncLevel: "balance_only",
      updatedAt: new Date(),
    })
    .where(eq(accountSyncSettings.id, acctSetting.id));

  // Deactivate the sync config (keep it for history)
  if (acctSetting.clientId) {
    await db
      .update(tripletexSyncConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(tripletexSyncConfigs.clientId, acctSetting.clientId));
  }

  return NextResponse.json({ status: "deactivated" });
});
