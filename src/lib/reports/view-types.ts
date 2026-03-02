import type { ReportType } from "./types";

// ---------------------------------------------------------------------------
// Interactive report workspace types
// ---------------------------------------------------------------------------

export interface AgingRow {
  customerId: string;
  invoiceNumber: string;
  dok: string;
  ref: string;
  dokDato: string;
  forfallsDato: string;
  gjeldende: number;
  forfalt_1_30: number;
  forfalt_31_50: number;
  forfalt_51_90: number;
  forfalt_over90: number;
  saldo: number;
}

export interface AgingTotals {
  gjeldende: number;
  forfalt_1_30: number;
  forfalt_31_50: number;
  forfalt_51_90: number;
  forfalt_over90: number;
  saldo: number;
}

export type OppfolgingStatus =
  | "none"
  | "task_open"
  | "task_completed"
  | "doc_requested";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface CustomerGroup {
  kundeId: string;
  navn: string;
  rows: AgingRow[];
  subtotal: AgingTotals;
  riskScore: number;
  riskLevel: RiskLevel;
  oppfolgingStatus: OppfolgingStatus;
}

export interface CustomerTaskInfo {
  status: OppfolgingStatus;
  taskCount: number;
  openCount: number;
  lastActivity?: string;
}

export interface ReportViewData {
  id: string;
  tittel: string;
  type: ReportType;
  firma: string;
  bruker: string;
  generertDato: string;
  aldersfordeltPer: string;
  kunder: CustomerGroup[];
  firmaTotalt: AgingTotals;
}

// Column config for generic table rendering across report types
export interface ColumnDef {
  key: string;
  label: string;
  align: "left" | "right";
  format?: "currency" | "date" | "text";
  highlight?: "overdue";
}

export const AGING_COLUMNS: ColumnDef[] = [
  { key: "dok", label: "Dok", align: "left", format: "text" },
  { key: "ref", label: "Ref.nr", align: "left", format: "text" },
  { key: "dokDato", label: "Dok.dato", align: "left", format: "date" },
  { key: "forfallsDato", label: "Forfallsdat", align: "left", format: "date" },
  { key: "gjeldende", label: "Gjeldende", align: "right", format: "currency" },
  { key: "forfalt_1_30", label: "1–30 d", align: "right", format: "currency" },
  { key: "forfalt_31_50", label: "31–50 d", align: "right", format: "currency" },
  { key: "forfalt_51_90", label: "51–90 d", align: "right", format: "currency" },
  { key: "forfalt_over90", label: ">90 d", align: "right", format: "currency", highlight: "overdue" },
  { key: "saldo", label: "Saldo", align: "right", format: "currency" },
];
