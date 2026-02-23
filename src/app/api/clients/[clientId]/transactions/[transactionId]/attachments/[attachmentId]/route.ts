import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactionAttachments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";

type RouteParams = {
  params: Promise<{ clientId: string; transactionId: string; attachmentId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId, attachmentId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

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
}
