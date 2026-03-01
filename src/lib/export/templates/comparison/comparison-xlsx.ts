import type { ComparisonExportViewModel } from "./comparison-viewmodel";
import { createWorkbook, toBuffer } from "../../xlsx/xlsx-renderer";
import { addSummarySheet, addDataSheet } from "../../xlsx/xlsx-components";

export function renderComparisonXlsx(vm: ComparisonExportViewModel): Buffer {
  const builder = createWorkbook();

  addSummarySheet(builder, "Sammendrag", [
    { label: "Rapport", value: "Krysselskaplig saldosammenligning" },
    { label: "Antall klienter", value: vm.clients.length },
    { label: "Netto hovedbok (sett 1)", value: vm.totals.nettoSet1 },
    { label: "Netto bank (sett 2)", value: vm.totals.nettoSet2 },
    { label: "Totalt åpne poster", value: vm.totals.totalUnmatchedCount },
    { label: "Generert", value: vm.genererTidspunkt.slice(0, 10) },
    ...(vm.generatedBy
      ? [{ label: "Generert av", value: vm.generatedBy }]
      : []),
  ]);

  const columns = [
    { header: "Klient", width: 30 },
    { header: "Selskap", width: 25 },
    { header: "Konto sett 1", width: 15 },
    { header: "Saldo hovedbok", width: 18, numFmt: "#,##0.00" },
    { header: "Konto sett 2", width: 15 },
    { header: "Saldo bank", width: 18, numFmt: "#,##0.00" },
    { header: "Åpne poster", width: 12 },
  ];

  const dataRows = vm.clients.map((c) => [
    c.name,
    c.companyName,
    c.set1AccountNumber,
    c.balanceSet1,
    c.set2AccountNumber,
    c.balanceSet2,
    c.unmatchedCountSet1 + c.unmatchedCountSet2,
  ]);

  // Netto mellom klienter — hele poenget med rapporten
  const nettoRow: (string | number)[] = [
    "Netto mellom klienter",
    "",
    "",
    vm.totals.nettoSet1,
    "",
    vm.totals.nettoSet2,
    vm.totals.totalUnmatchedCount,
  ];

  addDataSheet(builder, "Saldosammenligning", columns, [...dataRows, nettoRow]);

  return toBuffer(builder);
}
