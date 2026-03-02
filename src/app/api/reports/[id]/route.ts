import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, reports } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { companies } from "@/lib/db/schema";
import { supabase, REPORTS_BUCKET } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export const GET = withTenant(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [row] = await db
    .select({
      id: reports.id,
      reportType: reports.reportType,
      title: reports.title,
      format: reports.format,
      fileName: reports.fileName,
      fileUrl: reports.fileUrl,
      summary: reports.summary,
      config: reports.config,
      periodYear: reports.periodYear,
      periodMonth: reports.periodMonth,
      asOfDate: reports.asOfDate,
      sourceSystem: reports.sourceSystem,
      generatedBy: reports.generatedBy,
      generatedAt: reports.generatedAt,
      companyId: reports.companyId,
      companyName: companies.name,
    })
    .from(reports)
    .innerJoin(companies, eq(reports.companyId, companies.id))
    .where(and(eq(reports.id, id), eq(reports.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Rapport ikke funnet" }, { status: 404 });
  return NextResponse.json(row);
});

export const DELETE = withTenant(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [row] = await db
    .select({ id: reports.id, fileUrl: reports.fileUrl })
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Rapport ikke funnet" }, { status: 404 });

  if (supabase && row.fileUrl) {
    await supabase.storage.from(REPORTS_BUCKET).remove([row.fileUrl]);
  }

  await db.delete(reports).where(eq(reports.id, id));

  await logAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "report.deleted",
    entityType: "report",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
});
