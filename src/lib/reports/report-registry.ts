import type { ReportTypeDefinition } from "./types";

export const reportTypes: ReportTypeDefinition[] = [
  {
    id: "accounts_receivable",
    title: "Kundefordringer",
    description: "Aldersfordelt oversikt over utestående kundefakturaer",
    icon: "FileInput",
    requiredParams: ["asOfDate"],
    supportedFormats: ["pdf", "excel"],
  },
  {
    id: "accounts_payable",
    title: "Leverandørgjeld",
    description: "Aldersfordelt oversikt over utestående leverandørfakturaer",
    icon: "FileOutput",
    requiredParams: ["asOfDate"],
    supportedFormats: ["pdf", "excel"],
  },
  {
    id: "vat_summary",
    title: "MVA-oppstilling",
    description: "MVA-transaksjoner gruppert per kode med totaler",
    icon: "Receipt",
    requiredParams: ["periodYear", "periodMonth"],
    supportedFormats: ["pdf", "excel"],
  },
  {
    id: "payroll_summary",
    title: "Lønnsoppstilling",
    description: "Lønn per ansatt med brutto, skatt, netto og AGA",
    icon: "Users",
    requiredParams: ["periodYear", "periodMonth"],
    supportedFormats: ["pdf", "excel"],
  },
  {
    id: "holiday_pay",
    title: "Feriepenger",
    description: "Feriepengegrunnlag og beregning per ansatt",
    icon: "Palmtree",
    requiredParams: ["periodYear"],
    supportedFormats: ["pdf", "excel"],
  },
];

export function getReportTypeDefinition(id: string): ReportTypeDefinition | undefined {
  return reportTypes.find((r) => r.id === id);
}

export const REPORT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  reportTypes.map((r) => [r.id, r.title])
);
