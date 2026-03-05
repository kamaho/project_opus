import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/api-handler";
import { db, verifyCompanyOwnership, controlResults } from "@/lib/db";
import { tripletexConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAdapter } from "@/lib/accounting";
import { runAccountsReceivableControl } from "@/lib/controls/engines/accounts-receivable";
import { runAccountsPayableControl } from "@/lib/controls/engines/accounts-payable";
import { generateControlReport } from "@/lib/controls/report-generator";

export const maxDuration = 60;
import { supabase, CONTROL_REPORTS_BUCKET } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import type { ControlResult } from "@/lib/controls/types";

const runControlSchema = z.object({
  controlType: z.enum(["accounts_receivable", "accounts_payable"]),
  companyId: z.string().uuid(),
  asOfDate: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  generateReport: z.boolean().default(true),
  reportFormat: z.enum(["pdf", "excel", "both"]).default("both"),
});

export const POST = withTenant(async (req: NextRequest, ctx) => {
  const body = await req.json();
  const parsed = runControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { controlType, companyId, asOfDate: asOfDateStr, config, generateReport: genReport, reportFormat } = parsed.data;

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
    console.warn("[controls] No Tripletex connection — using demo adapter");
  }

  const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

  let result: ControlResult;

  try {
    if (controlType === "accounts_receivable") {
      let entries = await adapter.getAccountsReceivable(asOfDate);
      if (entries.length === 0 && adapter.systemId !== "demo") {
        console.warn("[controls] Empty receivable data — falling back to demo");
        const demoAdapter = await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });
        entries = await demoAdapter.getAccountsReceivable(asOfDate);
      }
      result = runAccountsReceivableControl(entries, asOfDate, config);
    } else {
      let entries = await adapter.getAccountsPayable(asOfDate);
      if (entries.length === 0 && adapter.systemId !== "demo") {
        console.warn("[controls] Empty payable data — falling back to demo");
        const demoAdapter = await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });
        entries = await demoAdapter.getAccountsPayable(asOfDate);
      }
      result = runAccountsPayableControl(entries, asOfDate, config);
    }
  } catch (e) {
    console.error("[controls] Data fetch failed:", e);
    const msg = e instanceof Error ? e.message : String(e);

    let userError: string;
    if (msg.includes("Illegal field")) {
      userError = "Intern feil: ugyldig feltfilter mot regnskapssystemet. Kontakt support.";
    } else if (msg.includes("422") || msg.includes("Validation")) {
      userError = "Regnskapssystemet støtter ikke denne kontrolltypen for valgt selskap. Sjekk at selskapet har fakturadata.";
    } else if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized")) {
      userError = "Tilkoblingen til regnskapssystemet er utløpt eller mangler tilgang. Sjekk innstillinger.";
    } else if (msg.includes("404")) {
      userError = "Endepunktet finnes ikke i regnskapssystemet. Sjekk at tilkoblingen er konfigurert riktig.";
    } else {
      userError = "Kunne ikke hente data fra regnskapssystemet. Prøv igjen senere.";
    }

    return NextResponse.json({ error: userError }, { status: 400 });
  }

  result.sourceLabel = adapter.systemName;

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

  const [saved] = await db
    .insert(controlResults)
    .values({
      tenantId: ctx.tenantId,
      companyId,
      controlType,
      asOfDate,
      overallStatus: result.overallStatus,
      summary: result.summary,
      deviations: result.deviations,
      sourceSystem: adapter.systemId,
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
    metadata: { controlType, companyId, overallStatus: result.overallStatus, deviationCount: result.deviations.length },
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
});
