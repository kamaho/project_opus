import type { ReceivableEntry } from "@/lib/accounting/types";
import type {
  ControlResult,
  Deviation,
  Severity,
  AgingEntry,
  CustomerSummary,
} from "../types";
import { calculateDaysOverdue, buildAgingBuckets } from "./aging";

export interface ReceivableControlConfig {
  overdueWarningDays: number;
  overdueErrorDays: number;
  totalOverdueWarningAmount: number;
  customerOverdueWarningAmount: number;
}

const DEFAULT_CONFIG: ReceivableControlConfig = {
  overdueWarningDays: 30,
  overdueErrorDays: 90,
  totalOverdueWarningAmount: 100_000,
  customerOverdueWarningAmount: 50_000,
};

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

export function runAccountsReceivableControl(
  entries: ReceivableEntry[],
  asOfDate: Date,
  config?: Partial<ReceivableControlConfig>
): ControlResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const deviations: Deviation[] = [];
  let deviationId = 0;

  const agingEntries: AgingEntry[] = entries.map((e) => {
    const days = calculateDaysOverdue(e.dueDate, asOfDate);
    return {
      id: e.invoiceNumber,
      name: e.customerName,
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
        description: `Faktura ${entry.reference} fra ${entry.name} er ${entry.daysOverdue} dager forfalt (${NOK.format(entry.amount)})`,
        reference: entry.reference,
        amount: entry.amount,
        difference: entry.daysOverdue,
        details: { customerName: entry.name, dueDate: entry.dueDate.toISOString() },
      });
    } else if (entry.daysOverdue >= cfg.overdueWarningDays) {
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "overdue_invoice",
        description: `Faktura ${entry.reference} fra ${entry.name} er ${entry.daysOverdue} dager forfalt (${NOK.format(entry.amount)})`,
        reference: entry.reference,
        amount: entry.amount,
        difference: entry.daysOverdue,
        details: { customerName: entry.name, dueDate: entry.dueDate.toISOString() },
      });
    }
  }

  // Group by customer
  const customerMap = new Map<string, CustomerSummary>();
  for (const entry of agingEntries) {
    const key = entry.name || entry.id;
    const existing = customerMap.get(key);
    const overdue = entry.daysOverdue > 0 ? entry.amount : 0;

    if (existing) {
      existing.totalOutstanding += entry.amount;
      existing.totalOverdue += overdue;
      existing.invoiceCount++;
      existing.oldestOverdueDays = Math.max(existing.oldestOverdueDays, entry.daysOverdue);
    } else {
      customerMap.set(key, {
        id: entry.id,
        name: entry.name || entry.id,
        totalOutstanding: entry.amount,
        totalOverdue: overdue,
        invoiceCount: 1,
        oldestOverdueDays: Math.max(0, entry.daysOverdue),
      });
    }
  }

  const byCustomer = Array.from(customerMap.values()).sort(
    (a, b) => b.totalOverdue - a.totalOverdue
  );

  // Per-customer deviations
  for (const cust of byCustomer) {
    if (cust.totalOverdue >= cfg.customerOverdueWarningAmount) {
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "customer_concentration",
        description: `${cust.name} har ${NOK.format(cust.totalOverdue)} forfalt (${cust.invoiceCount} fakturaer, eldste ${cust.oldestOverdueDays} dager)`,
        reference: cust.name,
        amount: cust.totalOverdue,
        details: { invoiceCount: cust.invoiceCount, oldestOverdueDays: cust.oldestOverdueDays },
      });
    }
  }

  // Total overdue deviation
  const totalOverdue = byCustomer.reduce((s, c) => s + c.totalOverdue, 0);
  if (totalOverdue >= cfg.totalOverdueWarningAmount) {
    deviations.push({
      id: String(++deviationId),
      severity: "info",
      category: "total_overdue",
      description: `Total forfalt beløp er ${NOK.format(totalOverdue)}`,
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
    controlType: "accounts_receivable",
    title: "Kundefordringer — aldersfordeling",
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
      byCustomer,
    },
  };
}
