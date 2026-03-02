import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, controlResults } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const GET = withTenant(async (req: NextRequest, ctx) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  const controlType = url.searchParams.get("controlType");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const conditions = [eq(controlResults.tenantId, ctx.tenantId)];
  if (companyId) conditions.push(eq(controlResults.companyId, companyId));
  if (controlType) conditions.push(eq(controlResults.controlType, controlType));

  const rows = await db
    .select({
      id: controlResults.id,
      companyId: controlResults.companyId,
      companyName: companies.name,
      controlType: controlResults.controlType,
      asOfDate: controlResults.asOfDate,
      overallStatus: controlResults.overallStatus,
      summary: controlResults.summary,
      sourceSystem: controlResults.sourceSystem,
      reportPdfUrl: controlResults.reportPdfUrl,
      reportExcelUrl: controlResults.reportExcelUrl,
      executedAt: controlResults.executedAt,
      executedBy: controlResults.executedBy,
    })
    .from(controlResults)
    .innerJoin(companies, eq(controlResults.companyId, companies.id))
    .where(and(...conditions))
    .orderBy(desc(controlResults.executedAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ results: rows });
});
