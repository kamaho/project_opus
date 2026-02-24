import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig datoformat (YYYY-MM-DD)").optional(),
  amount: z.number().refine((v) => v !== 0, "Beløp kan ikke være 0").optional(),
  text: z.string().min(1, "Tekst er påkrevd").optional(),
  voucher: z.string().optional(),
});

/**
 * PATCH: Update a manual transaction (åpningspost). Only allowed when importId is null.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string; transactionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, transactionId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const [tx] = await db
    .select({ id: transactions.id, importId: transactions.importId, setNumber: transactions.setNumber })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.clientId, clientId)));

  if (!tx) {
    return NextResponse.json({ error: "Transaksjon ikke funnet" }, { status: 404 });
  }
  if (tx.importId !== null) {
    return NextResponse.json(
      { error: "Kun åpningsposter (manuelt opprettede) kan redigeres" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ugyldig forespørsel";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.date !== undefined) updates.date1 = parsed.data.date;
  if (parsed.data.amount !== undefined) updates.amount = String(parsed.data.amount);
  if (parsed.data.text !== undefined) updates.description = parsed.data.text;
  if (parsed.data.voucher !== undefined) updates.bilag = parsed.data.voucher || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Ingen felter å oppdatere" }, { status: 400 });
  }

  await db.update(transactions).set(updates).where(eq(transactions.id, transactionId));

  await logAudit({
    tenantId: orgId,
    userId,
    action: "transaction.updated",
    entityType: "transaction",
    entityId: transactionId,
    metadata: { manual: true, updatedFields: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE: Remove a manual transaction (åpningspost). Only allowed when importId is null.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clientId: string; transactionId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, transactionId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const [tx] = await db
    .select({
      id: transactions.id,
      importId: transactions.importId,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.clientId, clientId)));

  if (!tx) {
    return NextResponse.json({ error: "Transaksjon ikke funnet" }, { status: 404 });
  }
  if (tx.importId !== null) {
    return NextResponse.json(
      { error: "Kun åpningsposter (manuelt opprettede) kan slettes" },
      { status: 403 }
    );
  }

  await db.delete(transactions).where(eq(transactions.id, transactionId));

  await logAudit({
    tenantId: orgId,
    userId,
    action: "transaction.deleted",
    entityType: "transaction",
    entityId: transactionId,
    metadata: { manual: true },
  });

  return NextResponse.json({ ok: true });
}
