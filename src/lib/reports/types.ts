export type ReportType =
  | "accounts_receivable"
  | "accounts_payable"
  | "vat_summary"
  | "payroll_summary"
  | "holiday_pay";

export type ReportFormat = "pdf" | "excel";

export interface ReportConfig {
  reportType: ReportType;
  companyId: string;
  format: ReportFormat;
  asOfDate?: string;
  periodYear?: number;
  periodMonth?: number;
  periodQuarter?: number;
  title?: string;
  includeDetails?: boolean;
}

export interface ReportResult {
  id: string;
  reportType: ReportType;
  title: string;
  companyId: string;
  companyName: string;
  format: ReportFormat;
  generatedAt: Date;
  generatedBy: string;
  fileUrl: string;
  fileName: string;
  summary: ReportSummary;
}

export interface ReportSummary {
  totalAmount: number;
  lineCount: number;
  highlights: ReportHighlight[];
}

export interface ReportHighlight {
  label: string;
  value: string;
}

export interface ReportTypeDefinition {
  id: ReportType;
  title: string;
  description: string;
  icon: string;
  requiredParams: ("asOfDate" | "periodYear" | "periodMonth" | "periodQuarter")[];
  supportedFormats: ReportFormat[];
}
