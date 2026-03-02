import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, reports } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { supabase, REPORTS_BUCKET } from "@/lib/supabase";

export const GET = withTenant(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [row] = await db
    .select({
      fileUrl: reports.fileUrl,
      fileName: reports.fileName,
      format: reports.format,
    })
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Rapport ikke funnet" }, { status: 404 });

  if (!supabase || !row.fileUrl) {
    return NextResponse.json({ error: "Fil ikke tilgjengelig" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .download(row.fileUrl);

  if (error || !data) {
    return NextResponse.json({ error: "Kunne ikke laste ned fil" }, { status: 500 });
  }

  const contentType = row.format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const arrayBuffer = await data.arrayBuffer();

  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(row.fileName)}"`,
      "Content-Length": String(arrayBuffer.byteLength),
    },
  });
});
