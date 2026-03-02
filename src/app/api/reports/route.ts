import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, reports } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const GET = withTenant(async (req: NextRequest, ctx) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  const reportType = url.searchParams.get("reportType");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const conditions = [eq(reports.tenantId, ctx.tenantId)];
  if (companyId) conditions.push(eq(reports.companyId, companyId));
  if (reportType) conditions.push(eq(reports.reportType, reportType));

  const rows = await db
    .select({
      id: reports.id,
      reportType: reports.reportType,
      title: reports.title,
      format: reports.format,
      fileName: reports.fileName,
      summary: reports.summary,
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
    .where(and(...conditions))
    .orderBy(desc(reports.generatedAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
});
