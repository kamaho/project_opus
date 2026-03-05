import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConnection } from "@/lib/visma-nxt/auth";
import { db } from "@/lib/db";
import { companies, vismaNxtSyncConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const conn = await getConnection(orgId);
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
          eq(companies.tenantId, orgId),
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
    .where(eq(vismaNxtSyncConfigs.tenantId, orgId))
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
}
