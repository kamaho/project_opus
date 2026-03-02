import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  setNumber: z.union([z.literal(1), z.literal(2)]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig datoformat (YYYY-MM-DD)"),
  amount: z.number().refine((v) => v !== 0, "Beløp kan ikke være 0"),
  text: z.string().min(1, "Tekst er påkrevd"),
  voucher: z.string().optional(),
});

export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Ugyldig forespørsel";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { setNumber, date, amount, text, voucher } = parsed.data;

  let inserted: { id: string };
  try {
    const [row] = await db
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
    inserted = row;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    console.error("[api/transactions] POST error:", message, code, err);
    if (message.includes("duplicate") || message.includes("unique") || message.includes("constraint")) {
      return NextResponse.json({ error: "Transaksjonen finnes allerede." }, { status: 400 });
    }
    if (code === "42501") {
      return NextResponse.json({ error: "Ingen tilgang til å opprette transaksjon." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kunne ikke opprette transaksjon. Prøv igjen." }, { status: 500 });
  }

  await logAudit({
    tenantId,
    userId,
    action: "transaction.created",
    entityType: "transaction",
    entityId: inserted.id,
    metadata: { setNumber, amount, date, text, manual: true },
  });

  return NextResponse.json({ ok: true, id: inserted.id });
});
