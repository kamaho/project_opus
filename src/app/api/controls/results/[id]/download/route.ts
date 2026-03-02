import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, controlResults } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { supabase, CONTROL_REPORTS_BUCKET } from "@/lib/supabase";
import { generateControlReport } from "@/lib/controls/report-generator";
import type { ControlResult as ControlResultType } from "@/lib/controls/types";
import { CONTROL_TYPE_LABELS } from "@/lib/controls/types";

export const GET = withTenant(async (req: NextRequest, ctx, params) => {
  const id = params?.id;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") as "pdf" | "excel" | null;

  if (!id) {
    return NextResponse.json({ error: "Mangler id" }, { status: 400 });
  }
  if (!format || !["pdf", "excel"].includes(format)) {
    return NextResponse.json({ error: "Ugyldig format. Bruk ?format=pdf eller ?format=excel" }, { status: 400 });
  }

  const [row] = await db
    .select({
      id: controlResults.id,
      tenantId: controlResults.tenantId,
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
      metadata: controlResults.metadata,
    })
    .from(controlResults)
    .innerJoin(companies, eq(controlResults.companyId, companies.id))
    .where(and(eq(controlResults.id, id), eq(controlResults.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Kontrollresultat ikke funnet" }, { status: 404 });
  }

  // Try to serve from Supabase storage first
  const storedUrl = format === "pdf" ? row.reportPdfUrl : row.reportExcelUrl;
  if (storedUrl && supabase) {
    const { data, error } = await supabase.storage
      .from(CONTROL_REPORTS_BUCKET)
      .download(storedUrl);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      const typeLabel = CONTROL_TYPE_LABELS[row.controlType as keyof typeof CONTROL_TYPE_LABELS] ?? row.controlType;
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const mimeType = format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${typeLabel} - ${row.companyName}.${ext}"`,
          "Content-Length": String(buffer.length),
        },
      });
    }
  }

  // Regenerate on-the-fly if not stored
  const controlResult: ControlResultType = {
    controlType: row.controlType as ControlResultType["controlType"],
    title: CONTROL_TYPE_LABELS[row.controlType as keyof typeof CONTROL_TYPE_LABELS] ?? row.controlType,
    period: row.asOfDate ? { asOfDate: new Date(row.asOfDate) } : { asOfDate: new Date() },
    executedAt: row.executedAt ? new Date(row.executedAt) : new Date(),
    overallStatus: row.overallStatus as ControlResultType["overallStatus"],
    summary: row.summary as ControlResultType["summary"],
    deviations: row.deviations as ControlResultType["deviations"],
    sourceLabel: row.sourceSystem,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };

  const report = await generateControlReport(controlResult, format, row.companyName);

  return new NextResponse(new Uint8Array(report.buffer), {
    headers: {
      "Content-Type": report.mimeType,
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(report.buffer.length),
    },
  });
});
