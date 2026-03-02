import { createWorkbook, toBuffer } from "@/lib/export/xlsx/xlsx-renderer";
import { addSummarySheet, addDataSheet } from "@/lib/export/xlsx/xlsx-components";
import { REPORT_TYPE_LABELS } from "../report-registry";
import type { ReportConfig, ReportType } from "../types";
import type {
  ReceivableEntry,
  PayableEntry,
  VatSummary,
  PayrollData,
  HolidayPayData,
} from "@/lib/accounting/types";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function periodLabel(config: ReportConfig): string {
  if (config.asOfDate) return fmtDate(new Date(config.asOfDate));
  if (config.periodYear && config.periodMonth) {
    const d = new Date(config.periodYear, config.periodMonth - 1);
    return d.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  }
  if (config.periodYear) return String(config.periodYear);
  return "";
}

export function generateReportExcel(
  reportType: ReportType,
  data: unknown,
  companyName: string,
  config: ReportConfig,
): Buffer {
  const builder = createWorkbook();
  const typeLabel = REPORT_TYPE_LABELS[reportType] ?? reportType;
  const period = periodLabel(config);

  addSummarySheet(builder, "Sammendrag", [
    { label: "Rapporttype", value: typeLabel },
    { label: "Selskap", value: companyName },
    { label: "Periode", value: period },
    { label: "Generert", value: new Date().toLocaleString("nb-NO") },
  ]);

  switch (reportType) {
    case "accounts_receivable":
      buildReceivableExcel(data as ReceivableEntry[], builder);
      break;
    case "accounts_payable":
      buildPayableExcel(data as PayableEntry[], builder);
      break;
    case "vat_summary":
      buildVatExcel(data as VatSummary, builder);
      break;
    case "payroll_summary":
      buildPayrollExcel(data as PayrollData, builder);
      break;
    case "holiday_pay":
      buildHolidayPayExcel(data as HolidayPayData, builder);
      break;
  }

  return toBuffer(builder);
}

// ── Kundefordringer ─────────────────────────────────────────────────

function buildReceivableExcel(entries: ReceivableEntry[], builder: ReturnType<typeof createWorkbook>) {
  const total = entries.reduce((s, e) => s + e.remainingAmount, 0);

  const buckets = computeAgingBuckets(entries);
  addDataSheet(
    builder,
    "Aldersfordeling",
    [
      { header: "Periode", width: 20 },
      { header: "Antall", width: 10, numFmt: "#,##0" },
      { header: "Beløp", width: 18, numFmt: "#,##0" },
      { header: "Andel %", width: 10, numFmt: "0.0%" },
    ],
    [
      ...buckets.map((b) => [b.label, b.count, b.amount, total > 0 ? b.amount / total : 0]),
      ["Totalt", entries.length, total, 1],
    ]
  );

  addDataSheet(
    builder,
    "Alle poster",
    [
      { header: "Kunde", width: 25 },
      { header: "Fakturanr", width: 15 },
      { header: "Fakturadato", width: 14 },
      { header: "Forfallsdato", width: 14 },
      { header: "Beløp", width: 15, numFmt: "#,##0" },
      { header: "Utestående", width: 15, numFmt: "#,##0" },
      { header: "Valuta", width: 8 },
    ],
    entries.map((e) => [
      e.customerName,
      e.invoiceNumber,
      fmtDate(e.invoiceDate),
      fmtDate(e.dueDate),
      e.originalAmount,
      e.remainingAmount,
      e.currency,
    ])
  );

  const byCustomer = groupBy(entries, (e) => e.customerName);
  addDataSheet(
    builder,
    "Per kunde",
    [
      { header: "Kunde", width: 25 },
      { header: "Antall fakturaer", width: 18, numFmt: "#,##0" },
      { header: "Total utestående", width: 18, numFmt: "#,##0" },
    ],
    Object.entries(byCustomer).map(([name, items]) => [
      name,
      items.length,
      items.reduce((s, e) => s + e.remainingAmount, 0),
    ])
  );
}

// ── Leverandørgjeld ─────────────────────────────────────────────────

function buildPayableExcel(entries: PayableEntry[], builder: ReturnType<typeof createWorkbook>) {
  const total = entries.reduce((s, e) => s + e.remainingAmount, 0);

  const buckets = computeAgingBuckets(entries);
  addDataSheet(
    builder,
    "Aldersfordeling",
    [
      { header: "Periode", width: 20 },
      { header: "Antall", width: 10, numFmt: "#,##0" },
      { header: "Beløp", width: 18, numFmt: "#,##0" },
      { header: "Andel %", width: 10, numFmt: "0.0%" },
    ],
    [
      ...buckets.map((b) => [b.label, b.count, b.amount, total > 0 ? b.amount / total : 0]),
      ["Totalt", entries.length, total, 1],
    ]
  );

  addDataSheet(
    builder,
    "Alle poster",
    [
      { header: "Leverandør", width: 25 },
      { header: "Fakturanr", width: 15 },
      { header: "Fakturadato", width: 14 },
      { header: "Forfallsdato", width: 14 },
      { header: "Beløp", width: 15, numFmt: "#,##0" },
      { header: "Utestående", width: 15, numFmt: "#,##0" },
      { header: "Valuta", width: 8 },
    ],
    entries.map((e) => [
      e.supplierName,
      e.invoiceNumber,
      fmtDate(e.invoiceDate),
      fmtDate(e.dueDate),
      e.originalAmount,
      e.remainingAmount,
      e.currency,
    ])
  );

  const bySupplier = groupBy(entries, (e) => e.supplierName);
  addDataSheet(
    builder,
    "Per leverandør",
    [
      { header: "Leverandør", width: 25 },
      { header: "Antall fakturaer", width: 18, numFmt: "#,##0" },
      { header: "Total utestående", width: 18, numFmt: "#,##0" },
    ],
    Object.entries(bySupplier).map(([name, items]) => [
      name,
      items.length,
      items.reduce((s, e) => s + e.remainingAmount, 0),
    ])
  );
}

// ── MVA-oppstilling ─────────────────────────────────────────────────

function buildVatExcel(vat: VatSummary, builder: ReturnType<typeof createWorkbook>) {
  addSummarySheet(builder, "MVA-sammendrag", [
    { label: "Totalt grunnlag", value: vat.totalBasis },
    { label: "Total MVA", value: vat.totalVat },
    { label: "Antall MVA-koder", value: vat.lines.length },
  ]);

  addDataSheet(
    builder,
    "Per MVA-kode",
    [
      { header: "MVA-kode", width: 12 },
      { header: "Beskrivelse", width: 35 },
      { header: "Grunnlag", width: 18, numFmt: "#,##0" },
      { header: "Sats", width: 10, numFmt: "0%" },
      { header: "MVA-beløp", width: 18, numFmt: "#,##0" },
    ],
    vat.lines.map((l) => [l.vatCode, l.description, l.basis, l.rate, l.vatAmount])
  );
}

// ── Lønnsoppstilling ────────────────────────────────────────────────

function buildPayrollExcel(payroll: PayrollData, builder: ReturnType<typeof createWorkbook>) {
  addSummarySheet(builder, "Lønnssammendrag", [
    { label: "Antall ansatte", value: payroll.employees.length },
    { label: "Total brutto", value: payroll.totals.grossPay },
    { label: "Skattetrekk", value: payroll.totals.taxDeductions },
    { label: "AGA", value: payroll.totals.employerContributions },
    { label: "Pensjon", value: payroll.totals.pensionContributions },
    { label: "Total netto", value: payroll.totals.netPay },
  ]);

  addDataSheet(
    builder,
    "Per ansatt",
    [
      { header: "Ansatt", width: 25 },
      { header: "Brutto", width: 15, numFmt: "#,##0" },
      { header: "Skattetrekk", width: 15, numFmt: "#,##0" },
      { header: "AGA", width: 15, numFmt: "#,##0" },
      { header: "Pensjon", width: 15, numFmt: "#,##0" },
      { header: "Netto", width: 15, numFmt: "#,##0" },
    ],
    payroll.employees.map((e) => [
      e.name,
      e.grossPay,
      e.taxDeductions,
      e.employerContributions,
      e.pensionContributions,
      e.netPay,
    ])
  );

  const benefitRows: (string | number)[][] = [];
  for (const emp of payroll.employees) {
    for (const b of emp.benefits) {
      benefitRows.push([emp.name, b.code, b.description, b.amount]);
    }
  }
  if (benefitRows.length > 0) {
    addDataSheet(
      builder,
      "Ytelser og trekk",
      [
        { header: "Ansatt", width: 25 },
        { header: "Kode", width: 10 },
        { header: "Beskrivelse", width: 30 },
        { header: "Beløp", width: 15, numFmt: "#,##0" },
      ],
      benefitRows
    );
  }
}

// ── Feriepenger ─────────────────────────────────────────────────────

function buildHolidayPayExcel(hp: HolidayPayData, builder: ReturnType<typeof createWorkbook>) {
  addSummarySheet(builder, "Feriepengesammendrag", [
    { label: "År", value: hp.year },
    { label: "Antall ansatte", value: hp.employees.length },
    { label: "Totalt grunnlag", value: hp.totalBasis },
    { label: "Total feriepenger", value: hp.totalHolidayPay },
  ]);

  addDataSheet(
    builder,
    "Per ansatt",
    [
      { header: "Ansatt", width: 25 },
      { header: "Grunnlag", width: 18, numFmt: "#,##0" },
      { header: "Sats", width: 10, numFmt: "0.0%" },
      { header: "Beregnet", width: 18, numFmt: "#,##0" },
      { header: "Utbetalt", width: 18, numFmt: "#,##0" },
      { header: "Gjenstående", width: 18, numFmt: "#,##0" },
    ],
    hp.employees.map((e) => [
      e.name,
      e.holidayPayBasis,
      e.rate,
      e.calculatedHolidayPay,
      e.paidHolidayPay,
      e.remaining,
    ])
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

interface AgingEntry {
  dueDate: Date;
  remainingAmount: number;
}

interface AgingBucket {
  label: string;
  count: number;
  amount: number;
}

function computeAgingBuckets(entries: AgingEntry[]): AgingBucket[] {
  const now = new Date();
  const buckets: AgingBucket[] = [
    { label: "Ikke forfalt", count: 0, amount: 0 },
    { label: "0–30 dager", count: 0, amount: 0 },
    { label: "31–60 dager", count: 0, amount: 0 },
    { label: "61–90 dager", count: 0, amount: 0 },
    { label: "Over 90 dager", count: 0, amount: 0 },
  ];
  for (const e of entries) {
    const diffDays = Math.floor((now.getTime() - new Date(e.dueDate).getTime()) / 86400000);
    const idx = diffDays <= 0 ? 0 : diffDays <= 30 ? 1 : diffDays <= 60 ? 2 : diffDays <= 90 ? 3 : 4;
    buckets[idx].count++;
    buckets[idx].amount += e.remainingAmount;
  }
  return buckets;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}
