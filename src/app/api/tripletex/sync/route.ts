import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";

/**
 * POST /api/tripletex/sync
 * Manually trigger a sync for a specific client.
 */
export async function POST(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, syncConfigId } = (await request.json()) as {
    clientId?: string;
    syncConfigId?: string;
  };

  let configId = syncConfigId;

  if (!configId && clientId) {
    const [config] = await db
      .select({ id: tripletexSyncConfigs.id })
      .from(tripletexSyncConfigs)
      .where(
        and(
          eq(tripletexSyncConfigs.clientId, clientId),
          eq(tripletexSyncConfigs.tenantId, orgId)
        )
      )
      .limit(1);

    if (!config) {
      return NextResponse.json(
        { error: "No sync config found for this client" },
        { status: 404 }
      );
    }
    configId = config.id;
  }

  if (!configId) {
    return NextResponse.json(
      { error: "clientId or syncConfigId required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const [config] = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(
      and(
        eq(tripletexSyncConfigs.id, configId),
        eq(tripletexSyncConfigs.tenantId, orgId)
      )
    )
    .limit(1);

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  try {
    const result = await runFullSync(configId);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[tripletex/sync] Error:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
