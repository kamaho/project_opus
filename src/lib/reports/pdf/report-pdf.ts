import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { renderPdf } from "@/lib/export/pdf/pdf-renderer";
import {
  brandedReportHeader,
  reportMetaBlock,
  reportFooter,
  dataTable,
  dataTableWithFooter,
  summaryBlock,
  formatNok,
  formatDate,
  getRevizoLogoDataUrl,
} from "@/lib/export/pdf/pdf-components";
import { REPORT_TYPE_LABELS } from "../report-registry";
import type { ReportConfig, ReportType } from "../types";
import type {
  ReceivableEntry,
  PayableEntry,
  VatSummary,
  PayrollData,
  HolidayPayData,
} from "@/lib/accounting/types";

function fmtNok(v: number): string {
  return formatNok(v) + " kr";
}

function fmtDateObj(d: Date): string {
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtPct(v: number, total: number): string {
  if (total === 0) return "0,0 %";
  return ((v / total) * 100).toFixed(1).replace(".", ",") + " %";
}

function periodLabel(config: ReportConfig): string {
  if (config.asOfDate) return fmtDateObj(new Date(config.asOfDate));
  if (config.periodYear && config.periodMonth) {
    const d = new Date(config.periodYear, config.periodMonth - 1);
    return d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  }
  if (config.periodYear) return String(config.periodYear);
  return "";
}

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

function computeAgingBuckets(entries: { dueDate: Date; remainingAmount: number }[]): AgingBucket[] {
  const now = new Date();
  const buckets: AgingBucket[] = [
    { label: "Ikke forfalt", count: 0, amount: 0 },
    { label: "0–30 dager", count: 0, amount: 0 },
    { label: "31–60 dager", count: 0, amount: 0 },
    { label: "61–90 dager", count: 0, amount: 0 },
    { label: "Over 90 dager", count: 0, amount: 0 },
  ];
  for (const e of entries) {
    const diffDays = Math.floor((now.getTime() - e.dueDate.getTime()) / 86400000);
    const idx = diffDays <= 0 ? 0 : diffDays <= 30 ? 1 : diffDays <= 60 ? 2 : diffDays <= 90 ? 3 : 4;
    buckets[idx].count++;
    buckets[idx].amount += e.remainingAmount;
  }
  return buckets;
}

export async function generateReportPdf(
  reportType: ReportType,
  data: unknown,
  companyName: string,
  config: ReportConfig,
): Promise<Buffer> {
  const typeLabel = REPORT_TYPE_LABELS[reportType] ?? reportType;
  const period = periodLabel(config);
  const content: Content[] = [];

  const logoDataUrl = getRevizoLogoDataUrl();
  const images: Record<string, string> = {};
  if (logoDataUrl) images["logo"] = logoDataUrl;

  content.push(
    brandedReportHeader(config.title ?? typeLabel, {
      companyName,
      logoImageKey: logoDataUrl ? "logo" : undefined,
      period: config.asOfDate ? `Per ${period}` : period,
    })
  );

  switch (reportType) {
    case "accounts_receivable":
      buildReceivablePdf(data as ReceivableEntry[], content, config);
      break;
    case "accounts_payable":
      buildPayablePdf(data as PayableEntry[], content, config);
      break;
    case "vat_summary":
      buildVatPdf(data as VatSummary, content);
      break;
    case "payroll_summary":
      buildPayrollPdf(data as PayrollData, content);
      break;
    case "holiday_pay":
      buildHolidayPayPdf(data as HolidayPayData, content);
      break;
  }

  const now = new Date().toISOString();
  const docDef: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    content,
    images,
    footer: reportFooter("Revizo", now),
    defaultStyle: { font: "Roboto", fontSize: 9 },
  };

  return renderPdf(docDef);
}

// ── Kundefordringer ─────────────────────────────────────────────────

function buildReceivablePdf(entries: ReceivableEntry[], content: Content[], config: ReportConfig) {
  const total = entries.reduce((s, e) => s + e.remainingAmount, 0);
  const buckets = computeAgingBuckets(entries);

  content.push(
    summaryBlock([
      { label: "Antall fakturaer", value: String(entries.length) },
      { label: "Total utestående", value: fmtNok(total), bold: true },
    ])
  );

  if (config.includeDetails !== false) {
    content.push({ text: "Fakturaoversikt", fontSize: 11, bold: true, margin: [0, 8, 0, 4] } as Content);
    const rows = entries.map((e) => [
      e.customerName,
      e.invoiceNumber,
      fmtDateObj(new Date(e.invoiceDate)),
      fmtDateObj(new Date(e.dueDate)),
      fmtNok(e.originalAmount),
      fmtNok(e.remainingAmount),
      ageDays(e.dueDate),
    ]);
    content.push(
      dataTable(
        [
          { header: "Kunde", width: "*" },
          { header: "Fakturanr", width: "auto" },
          { header: "Fakturadato", width: "auto" },
          { header: "Forfallsdato", width: "auto" },
          { header: "Beløp", width: "auto", alignment: "right" },
          { header: "Utestående", width: "auto", alignment: "right" },
          { header: "Alder", width: "auto", alignment: "right" },
        ],
        rows,
        { zebraStripe: true }
      )
    );
  }

  content.push({ text: "Aldersfordeling", fontSize: 11, bold: true, margin: [0, 16, 0, 4] } as Content);
  const agingRows = buckets.map((b) => [
    b.label,
    String(b.count) + " poster",
    fmtNok(b.amount),
    fmtPct(b.amount, total),
  ]);
  content.push(
    dataTableWithFooter(
      [
        { header: "Periode", width: "*" },
        { header: "Antall", width: "auto", alignment: "right" },
        { header: "Beløp", width: "auto", alignment: "right" },
        { header: "Andel", width: "auto", alignment: "right" },
      ],
      agingRows,
      "Totalt",
      fmtNok(total)
    )
  );
}

// ── Leverandørgjeld ─────────────────────────────────────────────────

function buildPayablePdf(entries: PayableEntry[], content: Content[], config: ReportConfig) {
  const total = entries.reduce((s, e) => s + e.remainingAmount, 0);
  const buckets = computeAgingBuckets(entries);

  content.push(
    summaryBlock([
      { label: "Antall fakturaer", value: String(entries.length) },
      { label: "Total utestående", value: fmtNok(total), bold: true },
    ])
  );

  if (config.includeDetails !== false) {
    content.push({ text: "Fakturaoversikt", fontSize: 11, bold: true, margin: [0, 8, 0, 4] } as Content);
    const rows = entries.map((e) => [
      e.supplierName,
      e.invoiceNumber,
      fmtDateObj(new Date(e.invoiceDate)),
      fmtDateObj(new Date(e.dueDate)),
      fmtNok(e.originalAmount),
      fmtNok(e.remainingAmount),
      ageDays(e.dueDate),
    ]);
    content.push(
      dataTable(
        [
          { header: "Leverandør", width: "*" },
          { header: "Fakturanr", width: "auto" },
          { header: "Fakturadato", width: "auto" },
          { header: "Forfallsdato", width: "auto" },
          { header: "Beløp", width: "auto", alignment: "right" },
          { header: "Utestående", width: "auto", alignment: "right" },
          { header: "Alder", width: "auto", alignment: "right" },
        ],
        rows,
        { zebraStripe: true }
      )
    );
  }

  content.push({ text: "Aldersfordeling", fontSize: 11, bold: true, margin: [0, 16, 0, 4] } as Content);
  const agingRows = buckets.map((b) => [
    b.label,
    String(b.count) + " poster",
    fmtNok(b.amount),
    fmtPct(b.amount, total),
  ]);
  content.push(
    dataTableWithFooter(
      [
        { header: "Periode", width: "*" },
        { header: "Antall", width: "auto", alignment: "right" },
        { header: "Beløp", width: "auto", alignment: "right" },
        { header: "Andel", width: "auto", alignment: "right" },
      ],
      agingRows,
      "Totalt",
      fmtNok(total)
    )
  );
}

// ── MVA-oppstilling ─────────────────────────────────────────────────

function buildVatPdf(vat: VatSummary, content: Content[]) {
  content.push(
    summaryBlock([
      { label: "Antall MVA-koder", value: String(vat.lines.length) },
      { label: "Totalt grunnlag", value: fmtNok(vat.totalBasis) },
      { label: "Total MVA", value: fmtNok(vat.totalVat), bold: true },
    ])
  );

  const rows = vat.lines.map((l) => [
    l.vatCode,
    l.description,
    fmtNok(l.basis),
    (l.rate * 100).toFixed(0) + " %",
    fmtNok(l.vatAmount),
  ]);
  content.push(
    dataTableWithFooter(
      [
        { header: "MVA-kode", width: "auto" },
        { header: "Beskrivelse", width: "*" },
        { header: "Grunnlag", width: "auto", alignment: "right" },
        { header: "Sats", width: "auto", alignment: "right" },
        { header: "MVA-beløp", width: "auto", alignment: "right" },
      ],
      rows,
      "Totalt",
      fmtNok(vat.totalVat)
    )
  );
}

// ── Lønnsoppstilling ────────────────────────────────────────────────

function buildPayrollPdf(payroll: PayrollData, content: Content[]) {
  content.push(
    summaryBlock([
      { label: "Antall ansatte", value: String(payroll.employees.length) },
      { label: "Total brutto", value: fmtNok(payroll.totals.grossPay), bold: true },
      { label: "Total netto", value: fmtNok(payroll.totals.netPay) },
      { label: "AGA", value: fmtNok(payroll.totals.employerContributions) },
      { label: "Pensjon", value: fmtNok(payroll.totals.pensionContributions) },
    ])
  );

  const rows = payroll.employees.map((e) => [
    e.name,
    fmtNok(e.grossPay),
    fmtNok(e.taxDeductions),
    fmtNok(e.employerContributions),
    fmtNok(e.pensionContributions),
    fmtNok(e.netPay),
  ]);
  content.push(
    dataTableWithFooter(
      [
        { header: "Ansatt", width: "*" },
        { header: "Brutto", width: "auto", alignment: "right" },
        { header: "Skattetrekk", width: "auto", alignment: "right" },
        { header: "AGA", width: "auto", alignment: "right" },
        { header: "Pensjon", width: "auto", alignment: "right" },
        { header: "Netto", width: "auto", alignment: "right" },
      ],
      rows,
      "Totalt",
      fmtNok(payroll.totals.grossPay)
    )
  );
}

// ── Feriepenger ─────────────────────────────────────────────────────

function buildHolidayPayPdf(hp: HolidayPayData, content: Content[]) {
  content.push(
    summaryBlock([
      { label: "Antall ansatte", value: String(hp.employees.length) },
      { label: "Totalt grunnlag", value: fmtNok(hp.totalBasis) },
      { label: "Total feriepenger", value: fmtNok(hp.totalHolidayPay), bold: true },
    ])
  );

  const rows = hp.employees.map((e) => [
    e.name,
    fmtNok(e.holidayPayBasis),
    (e.rate * 100).toFixed(1).replace(".", ",") + " %",
    fmtNok(e.calculatedHolidayPay),
    fmtNok(e.paidHolidayPay),
    fmtNok(e.remaining),
  ]);
  content.push(
    dataTableWithFooter(
      [
        { header: "Ansatt", width: "*" },
        { header: "Grunnlag", width: "auto", alignment: "right" },
        { header: "Sats", width: "auto", alignment: "right" },
        { header: "Beregnet", width: "auto", alignment: "right" },
        { header: "Utbetalt", width: "auto", alignment: "right" },
        { header: "Gjenstående", width: "auto", alignment: "right" },
      ],
      rows,
      "Totalt",
      fmtNok(hp.totalHolidayPay)
    )
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function ageDays(dueDate: Date): string {
  const d = new Date(dueDate);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 0) return "Ikke forfalt";
  return `${diff}d`;
}
