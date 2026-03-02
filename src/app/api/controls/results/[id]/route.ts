import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, controlResults } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const GET = withTenant(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Mangler id" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: controlResults.id,
      companyId: controlResults.companyId,
      companyName: companies.name,
      controlType: controlResults.controlType,
      asOfDate: controlResults.asOfDate,
      overallStatus: controlResults.overallStatus,
      summary: controlResults.summary,
      deviations: controlResults.deviations,
      sourceSystem: controlResults.sourceSystem,
      reportPdfUrl: controlResults.reportPdfUrl,
      reportExcelUrl: controlResults.reportExcelUrl,
      executedAt: controlResults.executedAt,
      executedBy: controlResults.executedBy,
      metadata: controlResults.metadata,
    })
    .from(controlResults)
    .innerJoin(companies, eq(controlResults.companyId, companies.id))
    .where(and(eq(controlResults.id, id), eq(controlResults.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Kontrollresultat ikke funnet" }, { status: 404 });
  }

  return NextResponse.json(row);
});
