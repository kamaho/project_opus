import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/api-handler";
import { db, verifyCompanyOwnership, controlResults } from "@/lib/db";
import { controlConfigs, tripletexConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdapter } from "@/lib/accounting";
import { runControl, mergeParameters, ControlNotImplementedError } from "@/lib/controls/runner";
import "@/lib/controls/runners";
import { getControlDefinition } from "@/lib/controls/registry";
import { generateControlReport } from "@/lib/controls/report-generator";
import type { ControlType } from "@/lib/controls/types";

export const maxDuration = 60;
import { supabase, CONTROL_REPORTS_BUCKET } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

const SUPPORTED_TYPES = [
  "accounts_receivable",
  "accounts_payable",
  "payroll_a07",
  "periodization",
] as const;

const runControlSchema = z.object({
  controlType: z.enum(SUPPORTED_TYPES),
  companyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  accountNumbers: z.array(z.string()).optional(),
  asOfDate: z.string().optional(),
  periodYear: z.number().int().optional(),
  periodMonth: z.number().int().min(1).max(12).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  generateReport: z.boolean().default(true),
  reportFormat: z.enum(["pdf", "excel", "both"]).default("both"),
});

function mapAdapterError(msg: string): string {
  if (msg.includes("Illegal field")) {
    return "Intern feil: ugyldig feltfilter mot regnskapssystemet. Kontakt support.";
  }
  if (msg.includes("422") || msg.includes("Validation")) {
    return "Regnskapssystemet støtter ikke denne kontrolltypen for valgt selskap. Sjekk at selskapet har riktig data.";
  }
  if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized")) {
    return "Tilkoblingen til regnskapssystemet er utløpt eller mangler tilgang. Sjekk innstillinger.";
  }
  if (msg.includes("404")) {
    return "Endepunktet finnes ikke i regnskapssystemet. Sjekk at tilkoblingen er konfigurert riktig.";
  }
  if (msg.includes("not supported")) {
    return "Denne kontrollen støttes ikke av det tilkoblede regnskapssystemet.";
  }
  return "Kunne ikke hente data fra regnskapssystemet. Prøv igjen senere.";
}

export const POST = withTenant(async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = runControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    controlType,
    companyId,
    clientId,
    accountNumbers,
    asOfDate: asOfDateStr,
    periodYear,
    periodMonth,
    config: userConfig,
    generateReport: genReport,
    reportFormat,
  } = parsed.data;

  const company = await verifyCompanyOwnership(companyId, ctx.tenantId);

  const definition = getControlDefinition(controlType as ControlType);
  if (!definition) {
    return NextResponse.json(
      { error: `Ukjent kontrolltype: ${controlType}` },
      { status: 400 }
    );
  }

  // Resolve adapter
  const [conn] = await db
    .select()
    .from(tripletexConnections)
    .where(and(eq(tripletexConnections.tenantId, ctx.tenantId), eq(tripletexConnections.isActive, true)))
    .limit(1);

  const adapter = conn
    ? await getAdapter({ systemId: "tripletex", tenantId: ctx.tenantId })
    : await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });

  if (!conn) {
    console.warn("[controls] No Tripletex connection — using demo adapter");
  }

  // Resolve period
  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
  const period = periodYear
    ? { year: periodYear, month: periodMonth }
    : { asOfDate };

  // Load tenant config for this control if it exists
  const existingConfigs = await db
    .select()
    .from(controlConfigs)
    .where(
      and(
        eq(controlConfigs.tenantId, ctx.tenantId),
        eq(controlConfigs.controlType, controlType),
        eq(controlConfigs.enabled, true),
        companyId ? eq(controlConfigs.companyId, companyId) : undefined
      )
    )
    .limit(1);

  const savedConfig = existingConfigs[0];
  const configParams = savedConfig?.parameters as Record<string, unknown> | undefined;

  // Merge: registry defaults → saved config → request overrides
  const parameters = {
    ...mergeParameters(controlType as ControlType, configParams),
    ...userConfig,
  };

  try {
    const result = await runControl(controlType as ControlType, {
      tenantId: ctx.tenantId,
      companyId,
      clientId,
      accountNumbers,
      period,
      adapter,
      parameters,
    });

    // Generate reports
    let reportPdfUrl: string | null = null;
    let reportExcelUrl: string | null = null;

    if (genReport && supabase) {
      const shouldPdf = reportFormat === "pdf" || reportFormat === "both";
      const shouldExcel = reportFormat === "excel" || reportFormat === "both";

      if (shouldPdf) {
        try {
          const pdf = await generateControlReport(result, "pdf", company.name);
          const pdfPath = `${ctx.tenantId}/${companyId}/${controlType}/${Date.now()}.pdf`;
          const { error } = await supabase.storage
            .from(CONTROL_REPORTS_BUCKET)
            .upload(pdfPath, new Blob([new Uint8Array(pdf.buffer)]), { contentType: pdf.mimeType });
          if (!error) reportPdfUrl = pdfPath;
        } catch (e) {
          console.error("[controls] PDF generation failed:", e);
        }
      }

      if (shouldExcel) {
        try {
          const xlsx = await generateControlReport(result, "excel", company.name);
          const xlsxPath = `${ctx.tenantId}/${companyId}/${controlType}/${Date.now()}.xlsx`;
          const { error } = await supabase.storage
            .from(CONTROL_REPORTS_BUCKET)
            .upload(xlsxPath, new Blob([new Uint8Array(xlsx.buffer)]), { contentType: xlsx.mimeType });
          if (!error) reportExcelUrl = xlsxPath;
        } catch (e) {
          console.error("[controls] Excel generation failed:", e);
        }
      }
    }

    // Persist result
    const sevCounts = result.summary.deviationsBySeverity;
    const [saved] = await db
      .insert(controlResults)
      .values({
        tenantId: ctx.tenantId,
        companyId,
        clientId,
        configId: savedConfig?.id,
        controlType,
        asOfDate: "asOfDate" in period ? period.asOfDate : undefined,
        periodYear: "year" in period ? period.year : undefined,
        periodMonth: "month" in period ? period.month : undefined,
        overallStatus: result.overallStatus,
        summary: result.summary,
        deviations: result.deviations,
        sourceSystem: adapter.systemId,
        parametersUsed: parameters,
        deviationCount: sevCounts.error ?? 0,
        warningCount: sevCounts.warning ?? 0,
        totalDeviationAmount: String(result.summary.totalDeviationAmount),
        reportPdfUrl,
        reportExcelUrl,
        executedBy: ctx.userId,
        metadata: result.metadata,
      })
      .returning({ id: controlResults.id });

    await logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: "control.executed",
      entityType: "control_result",
      entityId: saved.id,
      metadata: {
        controlType,
        companyId,
        overallStatus: result.overallStatus,
        deviationCount: result.deviations.length,
      },
    });

    return NextResponse.json({
      id: saved.id,
      controlType: result.controlType,
      title: result.title,
      overallStatus: result.overallStatus,
      summary: result.summary,
      deviations: result.deviations,
      metadata: result.metadata,
      reportPdfUrl: reportPdfUrl ? `/api/controls/results/${saved.id}/download?format=pdf` : null,
      reportExcelUrl: reportExcelUrl ? `/api/controls/results/${saved.id}/download?format=excel` : null,
    });
  } catch (e) {
    if (e instanceof ControlNotImplementedError) {
      return NextResponse.json(
        { error: `Kontrollen "${definition.name}" er ikke implementert ennå.` },
        { status: 501 }
      );
    }

    console.error("[controls] Control execution failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: mapAdapterError(msg) }, { status: 400 });
  }
});
