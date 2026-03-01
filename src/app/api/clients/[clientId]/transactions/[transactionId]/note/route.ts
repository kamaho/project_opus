import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyNoteMention } from "@/lib/notifications";
import { z } from "zod";

const noteSchema = z.object({
  text: z.string().nullable(),
  mentionedUserId: z.string().optional(),
});

export const PATCH = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;
  const transactionId = params!.transactionId;

  const body = await req.json().catch(() => ({}));
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
      .set({ notat: null, notatAuthor: null, mentionedUserId: null, notatCreatedAt: null })
      .where(eq(transactions.id, transactionId));
    return NextResponse.json({ ok: true });
  }

  await db
    .update(transactions)
    .set({
      notat: noteText,
      notatAuthor: userId,
      mentionedUserId: mentionedUserId ?? null,
      notatCreatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId));

  if (mentionedUserId) {
    await notifyNoteMention({
      tenantId,
      fromUserId: userId,
      mentionedUserId,
      noteText,
      clientId,
      entityId: transactionId,
    });
  }

  return NextResponse.json({ ok: true });
});
