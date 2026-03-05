import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { getConnection } from "@/lib/visma-nxt/auth";
import { db } from "@/lib/db";
import { companies, accountSyncSettings, vismaNxtSyncConfigs } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }) => {
  const conn = await getConnection(tenantId);
  if (!conn || !conn.isActive) {
    return NextResponse.json({
      connected: false,
      companyNo: null,
      companyName: null,
      lastSync: null,
    });
  }

  let companyName: string | null = null;
  let companyId: string | null = null;
  if (conn.companyNo) {
    const [company] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, tenantId),
          eq(companies.vismaNxtCompanyNo, conn.companyNo)
        )
      )
      .limit(1);
    companyName = company?.name ?? null;
    companyId = company?.id ?? null;
  }

  let lastSync: string | null = null;

  const [syncConfig] = await db
    .select({ lastSyncAt: vismaNxtSyncConfigs.lastSyncAt })
    .from(vismaNxtSyncConfigs)
    .where(eq(vismaNxtSyncConfigs.tenantId, tenantId))
    .limit(1);
  if (syncConfig?.lastSyncAt) {
    lastSync = syncConfig.lastSyncAt.toISOString();
  }

  if (!lastSync && companyId) {
    const [acctSync] = await db
      .select({ lastBalanceSyncAt: accountSyncSettings.lastBalanceSyncAt })
      .from(accountSyncSettings)
      .where(
        and(
          eq(accountSyncSettings.tenantId, tenantId),
          eq(accountSyncSettings.companyId, companyId)
        )
      )
      .orderBy(desc(accountSyncSettings.lastBalanceSyncAt))
      .limit(1);
    if (acctSync?.lastBalanceSyncAt) {
      lastSync = acctSync.lastBalanceSyncAt.toISOString();
    }
  }

  return NextResponse.json({
    connected: true,
    companyNo: conn.companyNo,
    companyName,
    lastSync,
  });
});
