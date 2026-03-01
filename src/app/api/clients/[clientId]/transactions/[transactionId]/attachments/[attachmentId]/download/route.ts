import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactionAttachments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";

export const GET = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;
  const attachmentId = params!.attachmentId;

  if (!supabase) {
    return NextResponse.json({ error: "Storage ikke konfigurert" }, { status: 500 });
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

  const url = new URL(req.url);
  const inline = url.searchParams.get("inline") === "1";

  if (inline) {
    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .download(attachment.filePath);

    if (error || !data) {
      return NextResponse.json({ error: "Kunne ikke laste fil" }, { status: 500 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${attachment.filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.filePath, 60 * 5);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Kunne ikke generere nedlastingslenke" }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: attachment.filename,
    contentType: attachment.contentType,
  });
});
