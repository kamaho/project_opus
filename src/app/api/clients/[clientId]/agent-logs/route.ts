import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agentJobLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await validateClientTenant(clientId, orgId);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logs = await db
    .select()
    .from(agentJobLogs)
    .where(eq(agentJobLogs.clientId, clientId))
    .orderBy(desc(agentJobLogs.createdAt))
    .limit(20);

  return NextResponse.json(logs);
}
