import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { db } from "@/lib/db";
import { tripletexConnections, vismaNxtConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (_req, { tenantId }) => {
  const [tripletex, vismaNxt] = await Promise.all([
    db
      .select({ id: tripletexConnections.id, isActive: tripletexConnections.isActive })
      .from(tripletexConnections)
      .where(and(eq(tripletexConnections.tenantId, tenantId), eq(tripletexConnections.isActive, true)))
      .limit(1),
    db
      .select({ id: vismaNxtConnections.id, isActive: vismaNxtConnections.isActive, companyNo: vismaNxtConnections.companyNo })
      .from(vismaNxtConnections)
      .where(and(eq(vismaNxtConnections.tenantId, tenantId), eq(vismaNxtConnections.isActive, true)))
      .limit(1),
  ]);

  return NextResponse.json({
    tripletex: tripletex.length > 0,
    vismaNxt: vismaNxt.length > 0,
    vismaNxtCompanyConfigured: vismaNxt.length > 0 && vismaNxt[0].companyNo != null,
  });
});
