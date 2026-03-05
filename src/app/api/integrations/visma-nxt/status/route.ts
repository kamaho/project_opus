import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { getConnection } from "@/lib/visma-nxt/auth";
import { db } from "@/lib/db";
import { companies, vismaNxtSyncConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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
  if (conn.companyNo) {
    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.tenantId, tenantId),
          eq(companies.vismaNxtCompanyNo, conn.companyNo)
        )
      )
      .limit(1);
    companyName = company?.name ?? null;
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

  return NextResponse.json({
    connected: true,
    companyNo: conn.companyNo,
    companyName,
    lastSync,
  });
});
