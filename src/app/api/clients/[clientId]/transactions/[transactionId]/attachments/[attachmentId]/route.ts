import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactionAttachments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";

export const DELETE = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;
  const attachmentId = params!.attachmentId;

  const [attachment] = await db
    .select()
    .from(transactionAttachments)
    .where(
      and(
        eq(transactionAttachments.id, attachmentId),
        eq(transactionAttachments.clientId, clientId)
      )
    );

  if (!attachment) {
    return NextResponse.json({ error: "Vedlegg ikke funnet" }, { status: 404 });
  }

  if (supabase) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([attachment.filePath]);
  }

  await db
    .delete(transactionAttachments)
    .where(eq(transactionAttachments.id, attachmentId));

  return NextResponse.json({ ok: true });
});
