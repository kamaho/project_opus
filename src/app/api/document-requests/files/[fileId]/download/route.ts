import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentRequestFiles, documentRequests } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";

export const GET = withTenant(async (req, { tenantId }, params) => {
  const fileId = params?.fileId;
  if (!fileId) {
    return NextResponse.json({ error: "Mangler fileId" }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Storage ikke konfigurert" }, { status: 500 });
  }

  const [file] = await db
    .select({
      id: documentRequestFiles.id,
      filename: documentRequestFiles.filename,
      filePath: documentRequestFiles.filePath,
      contentType: documentRequestFiles.contentType,
      tenantId: documentRequests.tenantId,
    })
    .from(documentRequestFiles)
    .innerJoin(documentRequests, eq(documentRequestFiles.requestId, documentRequests.id))
    .where(
      and(
        eq(documentRequestFiles.id, fileId),
        eq(documentRequests.tenantId, tenantId),
      ),
    );

  if (!file) {
    return NextResponse.json({ error: "Fil ikke funnet" }, { status: 404 });
  }

  const url = new URL(req.url);
  const inline = url.searchParams.get("inline") === "1";

  if (inline) {
    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .download(file.filePath);

    if (error || !data) {
      return NextResponse.json({ error: "Kunne ikke laste fil" }, { status: 500 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(file.filePath, 60 * 5);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Kunne ikke generere nedlastingslenke" }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: file.filename,
    contentType: file.contentType,
  });
});
