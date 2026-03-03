import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";

/**
 * POST /api/tripletex/sync
 * Manually trigger a sync for a specific client.
 */
export const POST = withTenant(async (req, { tenantId }) => {
  const { clientId, syncConfigId } = (await req.json()) as {
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
          eq(tripletexSyncConfigs.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!config) {
      return NextResponse.json(
        { error: "Ingen synkroniseringskonfigurasjon funnet for denne klienten." },
        { status: 404 }
      );
    }
    configId = config.id;
  }

  if (!configId) {
    return NextResponse.json(
      { error: "Klient-ID eller synk-konfigurasjon-ID er påkrevd." },
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
        eq(tripletexSyncConfigs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!config) {
    return NextResponse.json({ error: "Konfigurasjon ikke funnet." }, { status: 404 });
  }

  try {
    const result = await runFullSync(configId);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[tripletex/sync] Error:", error);
    const { TripletexError } = await import("@/lib/tripletex");
    const message = error instanceof TripletexError
      ? error.userMessage
      : "Synkronisering feilet. Prøv igjen senere.";
    const status = error instanceof TripletexError ? Math.max(error.statusCode, 400) : 500;
    return NextResponse.json({ error: message }, { status });
  }
});
