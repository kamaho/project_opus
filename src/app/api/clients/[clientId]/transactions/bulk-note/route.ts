import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notifyNoteMention } from "@/lib/notifications";
import { z } from "zod";

const bulkNoteSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1),
  text: z.string().min(1),
  mentionedUserId: z.string().optional(),
});

export const PATCH = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const body = await req.json().catch(() => ({}));
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
      tenantId,
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
});
