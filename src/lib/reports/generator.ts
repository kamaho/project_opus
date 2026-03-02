import type { AccountingSystemAdapter } from "@/lib/accounting/types";
import type { ReportConfig, ReportSummary, ReportFormat } from "./types";
import { REPORT_TYPE_LABELS } from "./report-registry";
import { generateReportPdf } from "./pdf/report-pdf";
import { generateReportExcel } from "./xlsx/report-xlsx";

export interface ReportOutput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  summary: ReportSummary;
}

export async function generateReport(
  adapter: AccountingSystemAdapter,
  config: ReportConfig,
  companyName: string,
): Promise<ReportOutput> {
  const data = await fetchReportData(adapter, config);
  const summary = buildSummary(config.reportType, data);

  const typeLabel = REPORT_TYPE_LABELS[config.reportType] ?? config.reportType;
  const timestamp = new Date().toISOString().slice(0, 10);
  const ext = config.format === "pdf" ? "pdf" : "xlsx";
  const mimeType = config.format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const buffer = config.format === "pdf"
    ? await generateReportPdf(config.reportType, data, companyName, config)
    : generateReportExcel(config.reportType, data, companyName, config);

  return {
    buffer,
    filename: `${typeLabel} - ${companyName} - ${timestamp}.${ext}`,
    mimeType,
    summary,
  };
}

async function fetchReportData(adapter: AccountingSystemAdapter, config: ReportConfig) {
  switch (config.reportType) {
    case "accounts_receivable":
      return adapter.getAccountsReceivable(new Date(config.asOfDate!));
    case "accounts_payable":
      return adapter.getAccountsPayable(new Date(config.asOfDate!));
    case "vat_summary":
      return adapter.getVatSummary({ year: config.periodYear!, month: config.periodMonth });
    case "payroll_summary":
      return adapter.getPayrollData({ year: config.periodYear!, month: config.periodMonth });
    case "holiday_pay":
      return adapter.getHolidayPayData(config.periodYear!);
  }
}

function fmtNok(v: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v) + " kr";
}

function buildSummary(reportType: string, data: unknown): ReportSummary {
  switch (reportType) {
    case "accounts_receivable": {
      const entries = data as import("@/lib/accounting/types").ReceivableEntry[];
      const total = entries.reduce((s, e) => s + e.remainingAmount, 0);
      const overdue = entries.filter((e) => e.dueDate < new Date());
      const overdueAmount = overdue.reduce((s, e) => s + e.remainingAmount, 0);
      return {
        totalAmount: total,
        lineCount: entries.length,
        highlights: [
          { label: "Total utestående", value: fmtNok(total) },
          { label: "Herav forfalt", value: fmtNok(overdueAmount) },
          { label: "Antall forfalt", value: String(overdue.length) },
        ],
      };
    }
    case "accounts_payable": {
      const entries = data as import("@/lib/accounting/types").PayableEntry[];
      const total = entries.reduce((s, e) => s + e.remainingAmount, 0);
      const overdue = entries.filter((e) => e.dueDate < new Date());
      const overdueAmount = overdue.reduce((s, e) => s + e.remainingAmount, 0);
      return {
        totalAmount: total,
        lineCount: entries.length,
        highlights: [
          { label: "Total utestående", value: fmtNok(total) },
          { label: "Herav forfalt", value: fmtNok(overdueAmount) },
          { label: "Antall forfalt", value: String(overdue.length) },
        ],
      };
    }
    case "vat_summary": {
      const vat = data as import("@/lib/accounting/types").VatSummary;
      return {
        totalAmount: vat.totalVat,
        lineCount: vat.lines.length,
        highlights: [
          { label: "Total MVA", value: fmtNok(vat.totalVat) },
          { label: "Totalt grunnlag", value: fmtNok(vat.totalBasis) },
          { label: "Antall MVA-koder", value: String(vat.lines.length) },
        ],
      };
    }
    case "payroll_summary": {
      const payroll = data as import("@/lib/accounting/types").PayrollData;
      return {
        totalAmount: payroll.totals.grossPay,
        lineCount: payroll.employees.length,
        highlights: [
          { label: "Total brutto", value: fmtNok(payroll.totals.grossPay) },
          { label: "Total netto", value: fmtNok(payroll.totals.netPay) },
          { label: "Antall ansatte", value: String(payroll.employees.length) },
        ],
      };
    }
    case "holiday_pay": {
      const hp = data as import("@/lib/accounting/types").HolidayPayData;
      return {
        totalAmount: hp.totalHolidayPay,
        lineCount: hp.employees.length,
        highlights: [
          { label: "Total feriepenger", value: fmtNok(hp.totalHolidayPay) },
          { label: "Totalt grunnlag", value: fmtNok(hp.totalBasis) },
          { label: "Antall ansatte", value: String(hp.employees.length) },
        ],
      };
    }
    default:
      return { totalAmount: 0, lineCount: 0, highlights: [] };
  }
}
