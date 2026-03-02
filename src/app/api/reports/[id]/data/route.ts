import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db, reports } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { companies } from "@/lib/db/schema";
import { getAdapter } from "@/lib/accounting";
import { tripletexConnections } from "@/lib/db/schema";
import type { ReceivableEntry, PayableEntry } from "@/lib/accounting/types";
import type {
  ReportViewData,
  CustomerGroup,
  AgingRow,
  AgingTotals,
  RiskLevel,
} from "@/lib/reports/view-types";

function diffDays(dueDate: Date, asOf: Date): number {
  return Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyAging(entry: { dueDate: Date; remainingAmount: number }, asOf: Date): AgingTotals {
  const days = diffDays(entry.dueDate, asOf);
  const amt = entry.remainingAmount;
  const bucket: AgingTotals = {
    gjeldende: 0,
    forfalt_1_30: 0,
    forfalt_31_50: 0,
    forfalt_51_90: 0,
    forfalt_over90: 0,
    saldo: amt,
  };

  if (days <= 0) bucket.gjeldende = amt;
  else if (days <= 30) bucket.forfalt_1_30 = amt;
  else if (days <= 50) bucket.forfalt_31_50 = amt;
  else if (days <= 90) bucket.forfalt_51_90 = amt;
  else bucket.forfalt_over90 = amt;

  return bucket;
}

function computeRiskScore(entries: { dueDate: Date; remainingAmount: number }[], asOf: Date): number {
  let score = 0;
  for (const e of entries) {
    const days = diffDays(e.dueDate, asOf);
    if (days > 0) score += days * Math.abs(e.remainingAmount);
  }
  return score;
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 5_000_000) return "critical";
  if (score >= 1_000_000) return "high";
  if (score >= 200_000) return "medium";
  return "low";
}

function buildReceivableViewData(
  entries: ReceivableEntry[],
  asOfDate: Date,
): { kunder: CustomerGroup[]; firmaTotalt: AgingTotals } {
  const grouped = new Map<string, { navn: string; entries: ReceivableEntry[] }>();
  for (const e of entries) {
    const key = e.customerId || e.customerName;
    if (!grouped.has(key)) grouped.set(key, { navn: e.customerName, entries: [] });
    grouped.get(key)!.entries.push(e);
  }

  const firmaTotalt: AgingTotals = { gjeldende: 0, forfalt_1_30: 0, forfalt_31_50: 0, forfalt_51_90: 0, forfalt_over90: 0, saldo: 0 };
  const kunder: CustomerGroup[] = [];

  for (const [kundeId, group] of grouped) {
    const subtotal: AgingTotals = { gjeldende: 0, forfalt_1_30: 0, forfalt_31_50: 0, forfalt_51_90: 0, forfalt_over90: 0, saldo: 0 };
    const rows: AgingRow[] = [];

    for (const entry of group.entries) {
      const aging = classifyAging(entry, asOfDate);
      rows.push({
        customerId: entry.customerId,
        invoiceNumber: entry.invoiceNumber,
        dok: entry.originalAmount < 0 ? "Kreditnota" : "Faktura",
        ref: entry.invoiceNumber,
        dokDato: entry.invoiceDate.toISOString().split("T")[0],
        forfallsDato: entry.dueDate.toISOString().split("T")[0],
        ...aging,
      });
      subtotal.gjeldende += aging.gjeldende;
      subtotal.forfalt_1_30 += aging.forfalt_1_30;
      subtotal.forfalt_31_50 += aging.forfalt_31_50;
      subtotal.forfalt_51_90 += aging.forfalt_51_90;
      subtotal.forfalt_over90 += aging.forfalt_over90;
      subtotal.saldo += aging.saldo;
    }

    const risk = computeRiskScore(group.entries, asOfDate);
    kunder.push({
      kundeId,
      navn: group.navn,
      rows,
      subtotal,
      riskScore: risk,
      riskLevel: riskLevelFromScore(risk),
      oppfolgingStatus: "none",
    });
    firmaTotalt.gjeldende += subtotal.gjeldende;
    firmaTotalt.forfalt_1_30 += subtotal.forfalt_1_30;
    firmaTotalt.forfalt_31_50 += subtotal.forfalt_31_50;
    firmaTotalt.forfalt_51_90 += subtotal.forfalt_51_90;
    firmaTotalt.forfalt_over90 += subtotal.forfalt_over90;
    firmaTotalt.saldo += subtotal.saldo;
  }

  kunder.sort((a, b) => b.subtotal.saldo - a.subtotal.saldo);
  return { kunder, firmaTotalt };
}

function buildPayableViewData(
  entries: PayableEntry[],
  asOfDate: Date,
): { kunder: CustomerGroup[]; firmaTotalt: AgingTotals } {
  const grouped = new Map<string, { navn: string; entries: PayableEntry[] }>();
  for (const e of entries) {
    const key = e.supplierId || e.supplierName;
    if (!grouped.has(key)) grouped.set(key, { navn: e.supplierName, entries: [] });
    grouped.get(key)!.entries.push(e);
  }

  const firmaTotalt: AgingTotals = { gjeldende: 0, forfalt_1_30: 0, forfalt_31_50: 0, forfalt_51_90: 0, forfalt_over90: 0, saldo: 0 };
  const kunder: CustomerGroup[] = [];

  for (const [kundeId, group] of grouped) {
    const subtotal: AgingTotals = { gjeldende: 0, forfalt_1_30: 0, forfalt_31_50: 0, forfalt_51_90: 0, forfalt_over90: 0, saldo: 0 };
    const rows: AgingRow[] = [];

    for (const entry of group.entries) {
      const aging = classifyAging(entry, asOfDate);
      rows.push({
        customerId: entry.supplierId,
        invoiceNumber: entry.invoiceNumber,
        dok: entry.originalAmount < 0 ? "Kreditnota" : "Faktura",
        ref: entry.invoiceNumber,
        dokDato: entry.invoiceDate.toISOString().split("T")[0],
        forfallsDato: entry.dueDate.toISOString().split("T")[0],
        ...aging,
      });
      subtotal.gjeldende += aging.gjeldende;
      subtotal.forfalt_1_30 += aging.forfalt_1_30;
      subtotal.forfalt_31_50 += aging.forfalt_31_50;
      subtotal.forfalt_51_90 += aging.forfalt_51_90;
      subtotal.forfalt_over90 += aging.forfalt_over90;
      subtotal.saldo += aging.saldo;
    }

    const risk = computeRiskScore(group.entries, asOfDate);
    kunder.push({
      kundeId,
      navn: group.navn,
      rows,
      subtotal,
      riskScore: risk,
      riskLevel: riskLevelFromScore(risk),
      oppfolgingStatus: "none",
    });
    firmaTotalt.gjeldende += subtotal.gjeldende;
    firmaTotalt.forfalt_1_30 += subtotal.forfalt_1_30;
    firmaTotalt.forfalt_31_50 += subtotal.forfalt_31_50;
    firmaTotalt.forfalt_51_90 += subtotal.forfalt_51_90;
    firmaTotalt.forfalt_over90 += subtotal.forfalt_over90;
    firmaTotalt.saldo += subtotal.saldo;
  }

  kunder.sort((a, b) => b.subtotal.saldo - a.subtotal.saldo);
  return { kunder, firmaTotalt };
}

export const GET = withTenant(async (_req: NextRequest, ctx, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const [row] = await db
    .select({
      id: reports.id,
      reportType: reports.reportType,
      title: reports.title,
      config: reports.config,
      asOfDate: reports.asOfDate,
      periodYear: reports.periodYear,
      periodMonth: reports.periodMonth,
      generatedBy: reports.generatedBy,
      generatedAt: reports.generatedAt,
      companyId: reports.companyId,
      companyName: companies.name,
      sourceSystem: reports.sourceSystem,
    })
    .from(reports)
    .innerJoin(companies, eq(reports.companyId, companies.id))
    .where(and(eq(reports.id, id), eq(reports.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Rapport ikke funnet" }, { status: 404 });

  const reportType = row.reportType;
  if (reportType !== "accounts_receivable" && reportType !== "accounts_payable") {
    return NextResponse.json(
      { error: "Arbeidsbilde er foreløpig kun støttet for kundefordringer og leverandørgjeld." },
      { status: 400 },
    );
  }

  const [conn] = await db
    .select()
    .from(tripletexConnections)
    .where(and(eq(tripletexConnections.tenantId, ctx.tenantId), eq(tripletexConnections.isActive, true)))
    .limit(1);

  const adapter = conn
    ? await getAdapter({ systemId: "tripletex", tenantId: ctx.tenantId })
    : await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });

  const asOfDate = row.asOfDate ? new Date(row.asOfDate) : new Date();
  const aldersfordeltPer = asOfDate.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let viewData: ReportViewData;

  try {
    if (reportType === "accounts_receivable") {
      let entries = await adapter.getAccountsReceivable(asOfDate);
      if (entries.length === 0 && adapter.systemId !== "demo") {
        console.warn("[reports/data] Empty receivable data from adapter — falling back to demo");
        const demoAdapter = await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });
        entries = await demoAdapter.getAccountsReceivable(asOfDate);
      }
      const { kunder, firmaTotalt } = buildReceivableViewData(entries, asOfDate);
      viewData = {
        id: row.id,
        tittel: row.title,
        type: "accounts_receivable",
        firma: row.companyName,
        bruker: row.generatedBy,
        generertDato: row.generatedAt?.toISOString() ?? new Date().toISOString(),
        aldersfordeltPer,
        kunder,
        firmaTotalt,
      };
    } else {
      let entries = await adapter.getAccountsPayable(asOfDate);
      if (entries.length === 0 && adapter.systemId !== "demo") {
        console.warn("[reports/data] Empty payable data from adapter — falling back to demo");
        const demoAdapter = await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });
        entries = await demoAdapter.getAccountsPayable(asOfDate);
      }
      const { kunder, firmaTotalt } = buildPayableViewData(entries, asOfDate);
      viewData = {
        id: row.id,
        tittel: row.title,
        type: "accounts_payable",
        firma: row.companyName,
        bruker: row.generatedBy,
        generertDato: row.generatedAt?.toISOString() ?? new Date().toISOString(),
        aldersfordeltPer,
        kunder,
        firmaTotalt,
      };
    }
  } catch (e) {
    console.error("[reports/data] Failed to fetch live data:", e);
    return NextResponse.json(
      { error: "Kunne ikke hente data fra regnskapssystemet." },
      { status: 500 },
    );
  }

  return NextResponse.json(viewData);
});
