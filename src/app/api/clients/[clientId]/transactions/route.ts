import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  setNumber: z.union([z.literal(1), z.literal(2)]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig datoformat (YYYY-MM-DD)"),
  amount: z.number().refine((v) => v !== 0, "Beløp kan ikke være 0"),
  text: z.string().min(1, "Tekst er påkrevd"),
  voucher: z.string().optional(),
  affectBalance: z.boolean(),
});

export async function POST(
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ugyldig forespørsel";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { setNumber, date, amount, text, voucher, affectBalance } = parsed.data;

  const [inserted] = await db
    .insert(transactions)
    .values({
      clientId,
      setNumber,
      date1: date,
      amount: String(amount),
      description: text,
      bilag: voucher || null,
      matchStatus: "unmatched",
    })
    .returning({ id: transactions.id });

  if (affectBalance) {
    const [clientData] = await db
      .select({
        openingBalanceSet1: clients.openingBalanceSet1,
        openingBalanceSet2: clients.openingBalanceSet2,
      })
      .from(clients)
      .where(eq(clients.id, clientId));

    const currentBalance = parseFloat(
      (setNumber === 1
        ? clientData.openingBalanceSet1
        : clientData.openingBalanceSet2) ?? "0"
    );
    const newBalance = currentBalance + amount;
    const balanceField =
      setNumber === 1 ? "openingBalanceSet1" : "openingBalanceSet2";
    await db
      .update(clients)
      .set({ [balanceField]: String(newBalance) })
      .where(eq(clients.id, clientId));
  }

  await logAudit({
    tenantId: orgId,
    userId,
    action: "transaction.created",
    entityType: "transaction",
    entityId: inserted.id,
    metadata: { setNumber, amount, date, text, affectBalance, manual: true },
  });

  return NextResponse.json({ ok: true, id: inserted.id });
}
