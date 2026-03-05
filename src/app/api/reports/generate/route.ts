import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/api-handler";
import { db, verifyCompanyOwnership, reports } from "@/lib/db";
import { tripletexConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdapter } from "@/lib/accounting";
import { generateReport } from "@/lib/reports/generator";
import { getReportTypeDefinition, REPORT_TYPE_LABELS } from "@/lib/reports/report-registry";
import { supabase, REPORTS_BUCKET } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;
import type { ReportConfig } from "@/lib/reports/types";

const generateSchema = z.object({
  reportType: z.enum(["accounts_receivable", "accounts_payable", "vat_summary", "payroll_summary", "holiday_pay"]),
  companyId: z.string().uuid(),
  format: z.enum(["pdf", "excel"]),
  asOfDate: z.string().optional(),
  periodYear: z.number().int().optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  periodQuarter: z.number().int().min(1).max(4).optional(),
  title: z.string().max(200).optional(),
});

export const POST = withTenant(async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { reportType, companyId, format, asOfDate, periodYear, periodMonth, periodQuarter, title } = parsed.data;

  const typeDef = getReportTypeDefinition(reportType);
  if (!typeDef) {
    return NextResponse.json({ error: "Ukjent rapporttype" }, { status: 400 });
  }

  for (const p of typeDef.requiredParams) {
    const val = parsed.data[p as keyof typeof parsed.data];
    if (val === undefined || val === null) {
      return NextResponse.json(
        { error: `Mangler påkrevd parameter: ${p}` },
        { status: 400 }
      );
    }
  }

  const company = await verifyCompanyOwnership(companyId, ctx.tenantId);

  const [conn] = await db
    .select()
    .from(tripletexConnections)
    .where(and(eq(tripletexConnections.tenantId, ctx.tenantId), eq(tripletexConnections.isActive, true)))
    .limit(1);

  let adapter = conn
    ? await getAdapter({ systemId: "tripletex", tenantId: ctx.tenantId })
    : await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });

  if (!conn) {
    console.warn("[reports] No Tripletex connection — using demo adapter");
  }

  // For receivable/payable reports, check if adapter returns empty data and fall back to demo
  if (conn && (reportType === "accounts_receivable" || reportType === "accounts_payable")) {
    const testDate = asOfDate ? new Date(asOfDate) : new Date();
    const testEntries = reportType === "accounts_receivable"
      ? await adapter.getAccountsReceivable(testDate)
      : await adapter.getAccountsPayable(testDate);
    if (testEntries.length === 0) {
      console.warn(`[reports] Empty ${reportType} data from Tripletex — falling back to demo`);
      adapter = await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });
    }
  }

  const config: ReportConfig = {
    reportType,
    companyId,
    format,
    asOfDate,
    periodYear,
    periodMonth,
    periodQuarter,
    title,
    includeDetails: true,
  };

  let reportOutput;
  try {
    reportOutput = await generateReport(adapter, config, company.name);
  } catch (e) {
    console.error("[reports] Generation failed:", e);
    const msg = e instanceof Error ? e.message : String(e);

    let userError: string;
    if (msg.includes("Illegal field")) {
      userError = "Intern feil: ugyldig feltfilter mot regnskapssystemet. Kontakt support.";
    } else if (msg.includes("422") || msg.includes("Validation")) {
      userError = "Regnskapssystemet støtter ikke denne rapporttypen for valgt selskap.";
    } else if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized")) {
      userError = "Tilkoblingen til regnskapssystemet er utløpt eller mangler tilgang.";
    } else if (msg.includes("404")) {
      userError = "Endepunktet finnes ikke i regnskapssystemet.";
    } else {
      userError = "Kunne ikke generere rapport. Prøv igjen senere.";
    }
    return NextResponse.json({ error: userError }, { status: 400 });
  }

  const typeLabel = REPORT_TYPE_LABELS[reportType] ?? reportType;
  const periodStr = asOfDate
    ? new Date(asOfDate).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" })
    : periodYear && periodMonth
      ? new Date(periodYear, periodMonth - 1).toLocaleDateString("nb-NO", { month: "long", year: "numeric" })
      : periodYear
        ? String(periodYear)
        : "";
  const reportTitle = title ?? `${typeLabel} ${asOfDate ? "per" : ""} ${periodStr}`.trim();

  let fileUrl = "";
  if (supabase) {
    const ext = format === "pdf" ? "pdf" : "xlsx";
    const storagePath = `${ctx.tenantId}/${companyId}/${reportType}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(REPORTS_BUCKET)
      .upload(storagePath, new Blob([new Uint8Array(reportOutput.buffer)]), {
        contentType: reportOutput.mimeType,
      });
    if (error) {
      console.error("[reports] Storage upload failed:", error.message);
    } else {
      fileUrl = storagePath;
    }
  }

  const [saved] = await db
    .insert(reports)
    .values({
      tenantId: ctx.tenantId,
      companyId,
      reportType,
      title: reportTitle,
      format,
      fileUrl,
      fileName: reportOutput.filename,
      summary: reportOutput.summary,
      config,
      periodYear: periodYear ?? null,
      periodMonth: periodMonth ?? null,
      asOfDate: asOfDate ? new Date(asOfDate) : null,
      sourceSystem: adapter.systemId,
      generatedBy: ctx.userId,
    })
    .returning({ id: reports.id });

  await logAudit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: "report.generated",
    entityType: "report",
    entityId: saved.id,
    metadata: { reportType, companyId, format },
  });

  return NextResponse.json({
    id: saved.id,
    reportType,
    title: reportTitle,
    format,
    fileName: reportOutput.filename,
    summary: reportOutput.summary,
    downloadUrl: fileUrl ? `/api/reports/${saved.id}/download` : null,
    storageWarning: !fileUrl ? "Rapporten ble generert, men filen kunne ikke lagres. Prøv å generere på nytt." : undefined,
  });
});
