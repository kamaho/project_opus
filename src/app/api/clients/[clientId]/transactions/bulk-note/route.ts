import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { notifyNoteMention } from "@/lib/notifications";
import { z } from "zod";

const bulkNoteSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1),
  text: z.string().min(1),
  mentionedUserId: z.string().optional(),
});

type RouteParams = { params: Promise<{ clientId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
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
  const parsed = bulkNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig forespørsel" }, { status: 400 });
  }

  const { transactionIds, text: noteText, mentionedUserId } = parsed.data;

  await db
    .update(transactions)
    .set({
      notat: noteText,
      notatAuthor: userId,
      notatCreatedAt: new Date(),
    })
    .where(
      and(
        inArray(transactions.id, transactionIds),
        eq(transactions.clientId, clientId)
      )
    );

  if (mentionedUserId) {
    const groupKey = `bulk-note:${clientId}:${Date.now()}`;

    await notifyNoteMention({
      tenantId: orgId,
      fromUserId: userId,
      mentionedUserId,
      noteText,
      clientId,
      entityId: transactionIds[0],
      entityDescription: `${transactionIds.length} transaksjoner`,
      groupKey,
    });
  }

  return NextResponse.json({ ok: true, updated: transactionIds.length });
}
