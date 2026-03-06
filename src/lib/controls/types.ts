import type { PeriodParams } from "@/lib/accounting/types";

// ---------------------------------------------------------------------------
// Control result types — shared across all control engines
// ---------------------------------------------------------------------------

export type ControlType =
  | "payroll_a07"
  | "vat_reconciliation"
  | "accounts_receivable"
  | "accounts_payable"
  | "holiday_pay"
  | "periodization";

export type Severity = "ok" | "info" | "warning" | "error";

export interface ControlResult {
  controlType: ControlType;
  title: string;
  period: PeriodParams | { asOfDate: Date };
  executedAt: Date;
  overallStatus: Severity;
  summary: ControlSummary;
  deviations: Deviation[];
  sourceLabel: string;
  metadata: Record<string, unknown>;
}

export interface ControlSummary {
  totalChecked: number;
  totalDeviations: number;
  totalDeviationAmount: number;
  deviationsBySeverity: Record<Severity, number>;
}

export interface Deviation {
  id: string;
  severity: Severity;
  category: string;
  description: string;
  reference: string;
  amount: number;
  difference?: number;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Aging analysis — shared by AR and AP engines
// ---------------------------------------------------------------------------

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  count: number;
  totalAmount: number;
  percentage: number;
  entries: AgingEntry[];
}

export interface AgingEntry {
  id: string;
  name: string;
  reference: string;
  dueDate: Date;
  daysOverdue: number;
  amount: number;
}

export interface CustomerSummary {
  id: string;
  name: string;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  oldestOverdueDays: number;
}

export interface SupplierSummary {
  id: string;
  name: string;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  oldestOverdueDays: number;
}

// ---------------------------------------------------------------------------
// Norwegian labels
// ---------------------------------------------------------------------------

export const CONTROL_TYPE_LABELS: Record<ControlType, string> = {
  accounts_receivable: "Kundefordringer",
  accounts_payable: "Leverandørgjeld",
  payroll_a07: "Lønnsavstemming",
  vat_reconciliation: "MVA-avstemming",
  holiday_pay: "Feriepenger",
  periodization: "Periodisering",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  ok: "OK",
  info: "Info",
  warning: "Advarsel",
  error: "Feil",
};
