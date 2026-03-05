import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runFullSync } from "@/lib/tripletex/sync";
import { TripletexError } from "@/lib/tripletex";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

export const maxDuration = 120;

const bodySchema = z
  .object({
    clientId: z.string().uuid("Må være en gyldig UUID").optional(),
    syncConfigId: z.string().uuid("Må være en gyldig UUID").optional(),
  })
  .refine((d) => d.clientId || d.syncConfigId, {
    message: "Klient-ID eller synk-konfigurasjon-ID er påkrevd",
    path: ["clientId"],
  });

export const POST = withTenant(async (req, { tenantId }) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  let configId = parsed.data.syncConfigId;

  if (!configId && parsed.data.clientId) {
    const [config] = await db
      .select({ id: tripletexSyncConfigs.id })
      .from(tripletexSyncConfigs)
      .where(
        and(
          eq(tripletexSyncConfigs.clientId, parsed.data.clientId),
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

  const [config] = await db
    .select()
    .from(tripletexSyncConfigs)
    .where(
      and(
        eq(tripletexSyncConfigs.id, configId!),
        eq(tripletexSyncConfigs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!config) {
    return NextResponse.json({ error: "Konfigurasjon ikke funnet." }, { status: 404 });
  }

  try {
    const result = await runFullSync(configId!);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[tripletex/sync] Error:", error);
    const message = error instanceof TripletexError
      ? error.userMessage
      : "Synkronisering feilet. Prøv igjen senere.";
    const status = error instanceof TripletexError ? Math.max(error.statusCode, 400) : 500;
    return NextResponse.json({ error: message }, { status });
  }
});
