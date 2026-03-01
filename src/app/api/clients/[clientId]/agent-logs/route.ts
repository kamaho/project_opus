import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentJobLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const logs = await db
    .select()
    .from(agentJobLogs)
    .where(eq(agentJobLogs.clientId, clientId))
    .orderBy(desc(agentJobLogs.createdAt))
    .limit(20);

  return NextResponse.json(logs);
});
