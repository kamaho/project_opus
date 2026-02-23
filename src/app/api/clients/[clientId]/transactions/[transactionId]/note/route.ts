import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { notifyNoteMention } from "@/lib/notifications";
import { z } from "zod";

const noteSchema = z.object({
  text: z.string().nullable(),
  mentionedUserId: z.string().optional(),
});

type RouteParams = { params: Promise<{ clientId: string; transactionId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, transactionId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig forespørsel" }, { status: 400 });
  }

  const { text: noteText, mentionedUserId } = parsed.data;

  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.clientId, clientId)));

  if (!existing) {
    return NextResponse.json({ error: "Transaksjon ikke funnet" }, { status: 404 });
  }

  if (noteText === null) {
    await db
      .update(transactions)
      .set({ notat: null, notatAuthor: null, notatCreatedAt: null })
      .where(eq(transactions.id, transactionId));
    return NextResponse.json({ ok: true });
  }

  await db
    .update(transactions)
    .set({
      notat: noteText,
      notatAuthor: userId,
      notatCreatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  if (mentionedUserId) {
    await notifyNoteMention({
      tenantId: orgId,
      fromUserId: userId,
      mentionedUserId,
      noteText,
      clientId,
      entityId: transactionId,
    });
  }

  return NextResponse.json({ ok: true });
}
