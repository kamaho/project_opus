import { createWorkbook, toBuffer } from "@/lib/export/xlsx/xlsx-renderer";
import { addSummarySheet, addDataSheet } from "@/lib/export/xlsx/xlsx-components";
import type { ControlResult, AgingBucket, CustomerSummary, SupplierSummary } from "./types";
import { CONTROL_TYPE_LABELS, SEVERITY_LABELS } from "./types";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function generateControlExcel(
  result: ControlResult,
  companyName: string
): Buffer {
  const builder = createWorkbook();
  const typeLabel = CONTROL_TYPE_LABELS[result.controlType] ?? result.controlType;

  const periodStr = "asOfDate" in result.period
    ? fmtDate(result.period.asOfDate)
    : `${result.period.year}${result.period.month ? `-${String(result.period.month).padStart(2, "0")}` : ""}`;

  // Sheet 1: Sammendrag
  const summaryItems: { label: string; value: string | number }[] = [
    { label: "Kontrolltype", value: typeLabel },
    { label: "Selskap", value: companyName },
    { label: "Dato", value: periodStr },
    { label: "Kilde", value: result.sourceLabel || "Ukjent" },
    { label: "Status", value: SEVERITY_LABELS[result.overallStatus] },
    { label: "Poster sjekket", value: result.summary.totalChecked },
    { label: "Antall avvik", value: result.summary.totalDeviations },
    { label: "Sum avvik (kr)", value: result.summary.totalDeviationAmount },
  ];

  if (result.metadata.totalOutstanding != null) {
    summaryItems.push(
      { label: "Total utestående (kr)", value: result.metadata.totalOutstanding as number },
      { label: "Total forfalt (kr)", value: result.metadata.totalOverdue as number },
      { label: "Forfalt (%)", value: result.metadata.overduePercentage as number },
    );
  }

  summaryItems.push({ label: "Kjørt", value: fmtDate(result.executedAt) });
  addSummarySheet(builder, "Sammendrag", summaryItems);

  // Sheet 2: Aldersfordeling
  const agingBuckets = result.metadata.agingBuckets as AgingBucket[] | undefined;
  if (agingBuckets?.length) {
    addDataSheet(
      builder,
      "Aldersfordeling",
      [
        { header: "Intervall", width: 20 },
        { header: "Antall", width: 10 },
        { header: "Beløp (kr)", width: 18, numFmt: "#,##0.00" },
        { header: "Andel (%)", width: 12, numFmt: "0.0" },
      ],
      agingBuckets.map((b) => [b.label, b.count, b.totalAmount, b.percentage])
    );
  }

  // Sheet 3: Avvik
  if (result.deviations.length > 0) {
    addDataSheet(
      builder,
      "Avvik",
      [
        { header: "Alvorlighet", width: 14 },
        { header: "Kategori", width: 20 },
        { header: "Beskrivelse", width: 50 },
        { header: "Referanse", width: 18 },
        { header: "Beløp (kr)", width: 16, numFmt: "#,##0.00" },
      ],
      result.deviations.map((d) => [
        SEVERITY_LABELS[d.severity],
        d.category,
        d.description,
        d.reference,
        d.amount,
      ])
    );
  }

  // Sheet 4: Per kunde/leverandør
  const byCustomer = result.metadata.byCustomer as CustomerSummary[] | undefined;
  const bySupplier = result.metadata.bySupplier as SupplierSummary[] | undefined;

  if (byCustomer?.length) {
    addDataSheet(
      builder,
      "Per kunde",
      [
        { header: "Kunde", width: 30 },
        { header: "Total utestående (kr)", width: 22, numFmt: "#,##0.00" },
        { header: "Forfalt (kr)", width: 18, numFmt: "#,##0.00" },
        { header: "Antall fakturaer", width: 16 },
        { header: "Eldste forfalt (dager)", width: 22 },
      ],
      byCustomer.map((c) => [c.name, c.totalOutstanding, c.totalOverdue, c.invoiceCount, c.oldestOverdueDays])
    );
  }

  if (bySupplier?.length) {
    addDataSheet(
      builder,
      "Per leverandør",
      [
        { header: "Leverandør", width: 30 },
        { header: "Total utestående (kr)", width: 22, numFmt: "#,##0.00" },
        { header: "Forfalt (kr)", width: 18, numFmt: "#,##0.00" },
        { header: "Antall fakturaer", width: 16 },
        { header: "Eldste forfalt (dager)", width: 22 },
      ],
      bySupplier.map((s) => [s.name, s.totalOutstanding, s.totalOverdue, s.invoiceCount, s.oldestOverdueDays])
    );
  }

  return toBuffer(builder);
}
