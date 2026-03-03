import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexSyncConfigs, clients, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/tripletex/sync-config?clientId=xxx
 * Returns the sync config for a given client (if any).
 */
export const GET = withTenant(async (req, { tenantId }) => {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const [config] = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(
      and(
        eq(tripletexSyncConfigs.clientId, clientId),
        eq(tripletexSyncConfigs.tenantId, tenantId)
      )
    )
    .limit(1);

  return NextResponse.json({ config: config ?? null });
});

/**
 * POST /api/tripletex/sync-config
 * Creates a new sync config and runs initial sync.
 */
export const POST = withTenant(async (req, { tenantId }) => {
  const body = await req.json();
  const {
    clientId,
    tripletexCompanyId,
    set1TripletexAccountIds,
    set2TripletexAccountIds,
    enabledFields,
    dateFrom,
    syncIntervalMinutes,
    // Legacy single-account support
    set1TripletexAccountId,
    set2TripletexAccountId,
  } = body as {
    clientId: string;
    tripletexCompanyId: number;
    set1TripletexAccountIds?: number[];
    set2TripletexAccountIds?: number[];
    enabledFields?: Record<string, boolean>;
    dateFrom: string;
    syncIntervalMinutes?: number;
    set1TripletexAccountId?: number;
    set2TripletexAccountId?: number;
  };

  if (!clientId || !tripletexCompanyId || !dateFrom) {
    return NextResponse.json(
      { error: "clientId, tripletexCompanyId, and dateFrom are required" },
      { status: 400 }
    );
  }

  const resolvedSet1Ids = set1TripletexAccountIds ?? (set1TripletexAccountId ? [set1TripletexAccountId] : []);
  const resolvedSet2Ids = set2TripletexAccountIds ?? (set2TripletexAccountId ? [set2TripletexAccountId] : []);

  // Validate client belongs to tenant
  const [client] = await db
    .select({ id: clients.id, companyId: clients.companyId })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(clients.id, clientId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const t0 = Date.now();
    console.log(`[tripletex/sync-config] POST start: client=${clientId} txCompany=${tripletexCompanyId}`);

    const [config] = await db
      .insert(tripletexSyncConfigs)
      .values({
        clientId,
        tenantId,
        tripletexCompanyId,
        set1TripletexAccountId: resolvedSet1Ids[0] ?? null,
        set2TripletexAccountId: resolvedSet2Ids[0] ?? null,
        set1TripletexAccountIds: resolvedSet1Ids,
        set2TripletexAccountIds: resolvedSet2Ids,
        enabledFields: enabledFields ?? undefined,
        dateFrom,
        syncIntervalMinutes: syncIntervalMinutes ?? 60,
        syncStatus: "pending",
      })
      .onConflictDoUpdate({
        target: [tripletexSyncConfigs.clientId],
        set: {
          tripletexCompanyId,
          set1TripletexAccountId: resolvedSet1Ids[0] ?? null,
          set2TripletexAccountId: resolvedSet2Ids[0] ?? null,
          set1TripletexAccountIds: resolvedSet1Ids,
          set2TripletexAccountIds: resolvedSet2Ids,
          enabledFields: enabledFields ?? undefined,
          dateFrom,
          syncIntervalMinutes: syncIntervalMinutes ?? 60,
          syncStatus: "pending",
          syncError: null,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log(`[tripletex/sync-config] Config ${config.id} created in ${Date.now() - t0}ms, queueing background sync`);

    runFullSync(config.id).catch((err) => {
      console.error(`[tripletex/sync-config] Background sync failed for config=${config.id}:`, err);
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error("[tripletex/sync-config] POST error:", {
      clientId,
      tripletexCompanyId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Kunne ikke opprette synkronisering. Prøv igjen." },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/tripletex/sync-config
 * Updates an existing sync config.
 */
export const PATCH = withTenant(async (req, { tenantId }) => {
  const body = await req.json();
  const { configId, ...updates } = body as {
    configId: string;
    set1TripletexAccountId?: number;
    set2TripletexAccountId?: number;
    set1TripletexAccountIds?: number[];
    set2TripletexAccountIds?: number[];
    enabledFields?: Record<string, boolean>;
    syncIntervalMinutes?: number;
    isActive?: boolean;
  };

  if (!configId) {
    return NextResponse.json({ error: "configId required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(
      and(
        eq(tripletexSyncConfigs.id, configId),
        eq(tripletexSyncConfigs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(tripletexSyncConfigs)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tripletexSyncConfigs.id, configId))
    .returning();

  return NextResponse.json({ config: updated });
});
