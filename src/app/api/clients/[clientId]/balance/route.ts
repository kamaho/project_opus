import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  openingBalanceSet1: z.string().optional(),
  openingBalanceSet2: z.string().optional(),
  openingBalanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig datoformat").optional().nullable(),
});

/**
 * PATCH: Update opening balance for a client (avstemmingsenhet).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: "Sjekk at beløp er gyldige tall og dato er YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.openingBalanceSet1 !== undefined) {
    updates.openingBalanceSet1 = parsed.data.openingBalanceSet1;
  }
  if (parsed.data.openingBalanceSet2 !== undefined) {
    updates.openingBalanceSet2 = parsed.data.openingBalanceSet2;
  }
  if (parsed.data.openingBalanceDate !== undefined) {
    updates.openingBalanceDate = parsed.data.openingBalanceDate;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ingen felter å oppdatere" }, { status: 400 });
  }

  await db.update(clients).set(updates).where(eq(clients.id, clientId));

  await logAudit({
    tenantId: orgId,
    userId,
    action: "rule.updated",
    entityType: "client",
    entityId: clientId,
    metadata: { updatedFields: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true });
}
