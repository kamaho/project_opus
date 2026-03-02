import type { PayableEntry } from "@/lib/accounting/types";
import type {
  ControlResult,
  Deviation,
  Severity,
  AgingEntry,
  SupplierSummary,
} from "../types";
import { calculateDaysOverdue, buildAgingBuckets } from "./aging";

export interface PayableControlConfig {
  overdueWarningDays: number;
  overdueErrorDays: number;
  totalOverdueWarningAmount: number;
  supplierOverdueWarningAmount: number;
}

const DEFAULT_CONFIG: PayableControlConfig = {
  overdueWarningDays: 14,
  overdueErrorDays: 60,
  totalOverdueWarningAmount: 100_000,
  supplierOverdueWarningAmount: 50_000,
};

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

export function runAccountsPayableControl(
  entries: PayableEntry[],
  asOfDate: Date,
  config?: Partial<PayableControlConfig>
): ControlResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const deviations: Deviation[] = [];
  let deviationId = 0;

  const agingEntries: AgingEntry[] = entries.map((e) => {
    const days = calculateDaysOverdue(e.dueDate, asOfDate);
    return {
      id: e.invoiceNumber,
      name: e.supplierName,
      reference: e.invoiceNumber,
      dueDate: e.dueDate,
      daysOverdue: days,
      amount: e.remainingAmount,
    };
  });

  const agingBuckets = buildAgingBuckets(agingEntries);

  // Per-invoice deviations
  for (const entry of agingEntries) {
    if (entry.daysOverdue >= cfg.overdueErrorDays) {
      deviations.push({
        id: String(++deviationId),
        severity: "error",
        category: "overdue_invoice",
        description: `Leverandørfaktura ${entry.reference} fra ${entry.name} er ${entry.daysOverdue} dager forfalt (${NOK.format(entry.amount)})`,
        reference: entry.reference,
        amount: entry.amount,
        difference: entry.daysOverdue,
        details: { supplierName: entry.name, dueDate: entry.dueDate.toISOString() },
      });
    } else if (entry.daysOverdue >= cfg.overdueWarningDays) {
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "overdue_invoice",
        description: `Leverandørfaktura ${entry.reference} fra ${entry.name} er ${entry.daysOverdue} dager forfalt (${NOK.format(entry.amount)})`,
        reference: entry.reference,
        amount: entry.amount,
        difference: entry.daysOverdue,
        details: { supplierName: entry.name, dueDate: entry.dueDate.toISOString() },
      });
    }
  }

  // Group by supplier
  const supplierMap = new Map<string, SupplierSummary>();
  for (const entry of agingEntries) {
    const key = entry.name || entry.id;
    const existing = supplierMap.get(key);
    const overdue = entry.daysOverdue > 0 ? entry.amount : 0;

    if (existing) {
      existing.totalOutstanding += entry.amount;
      existing.totalOverdue += overdue;
      existing.invoiceCount++;
      existing.oldestOverdueDays = Math.max(existing.oldestOverdueDays, entry.daysOverdue);
    } else {
      supplierMap.set(key, {
        id: entry.id,
        name: entry.name || entry.id,
        totalOutstanding: entry.amount,
        totalOverdue: overdue,
        invoiceCount: 1,
        oldestOverdueDays: Math.max(0, entry.daysOverdue),
      });
    }
  }

  const bySupplier = Array.from(supplierMap.values()).sort(
    (a, b) => b.totalOverdue - a.totalOverdue
  );

  // Per-supplier deviations
  for (const sup of bySupplier) {
    if (sup.totalOverdue >= cfg.supplierOverdueWarningAmount) {
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "supplier_concentration",
        description: `${sup.name} har ${NOK.format(sup.totalOverdue)} forfalt (${sup.invoiceCount} fakturaer, eldste ${sup.oldestOverdueDays} dager)`,
        reference: sup.name,
        amount: sup.totalOverdue,
        details: { invoiceCount: sup.invoiceCount, oldestOverdueDays: sup.oldestOverdueDays },
      });
    }
  }

  // Total overdue
  const totalOverdue = bySupplier.reduce((s, c) => s + c.totalOverdue, 0);
  if (totalOverdue >= cfg.totalOverdueWarningAmount) {
    deviations.push({
      id: String(++deviationId),
      severity: "info",
      category: "total_overdue",
      description: `Total forfalt leverandørgjeld er ${NOK.format(totalOverdue)}`,
      reference: "Total",
      amount: totalOverdue,
    });
  }

  // Determine overall status
  const sevCounts: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };
  for (const d of deviations) sevCounts[d.severity]++;

  let overallStatus: Severity = "ok";
  if (sevCounts.error > 0) overallStatus = "error";
  else if (sevCounts.warning > 0) overallStatus = "warning";
  else if (sevCounts.info > 0) overallStatus = "info";

  const totalAmount = entries.reduce((s, e) => s + e.remainingAmount, 0);

  return {
    controlType: "accounts_payable",
    title: "Leverandørgjeld — aldersfordeling",
    period: { asOfDate },
    executedAt: new Date(),
    overallStatus,
    summary: {
      totalChecked: entries.length,
      totalDeviations: deviations.length,
      totalDeviationAmount: totalOverdue,
      deviationsBySeverity: sevCounts,
    },
    deviations,
    sourceLabel: "",
    metadata: {
      totalOutstanding: totalAmount,
      totalOverdue,
      overduePercentage: totalAmount > 0 ? Math.round((totalOverdue / totalAmount) * 1000) / 10 : 0,
      agingBuckets,
      bySupplier,
    },
  };
}
