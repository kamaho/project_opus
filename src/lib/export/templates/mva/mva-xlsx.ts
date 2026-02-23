import type { MvaExportViewModel } from "../../types";
import { createWorkbook, toBuffer } from "../../xlsx/xlsx-renderer";
import { addSummarySheet, addDataSheet } from "../../xlsx/xlsx-components";

export function renderMvaXlsx(vm: MvaExportViewModel): Buffer {
  const builder = createWorkbook();

  addSummarySheet(builder, "Sammendrag", [
    { label: "Rapport", value: "MVA-avstemming" },
    { label: "Termin", value: vm.termin },
    { label: "Sum beregnet", value: vm.totalBeregnet },
    { label: "Sum bokført", value: vm.totalBokfort },
    { label: "Differanse", value: vm.totalDifferanse },
    { label: "Generert", value: vm.genererTidspunkt.slice(0, 10) },
  ]);

  const columns = [
    { header: "MVA-kode", width: 12 },
    { header: "Beskrivelse", width: 30 },
    { header: "Grunnlag", width: 15, numFmt: "#,##0" },
    { header: "Sats %", width: 8 },
    { header: "Beregnet", width: 15, numFmt: "#,##0" },
    { header: "Bokført", width: 15, numFmt: "#,##0" },
    { header: "Differanse", width: 15, numFmt: "#,##0" },
    { header: "Årsak", width: 18 },
    { header: "Kommentar", width: 35 },
  ];

  const rows = vm.linjer.map((l) => [
    l.mvaKode,
    l.beskrivelse,
    l.grunnlag,
    l.sats,
    l.beregnet,
    l.bokfort,
    l.differanse,
    l.aarsak || "",
    l.kommentar || "",
  ]);

  addDataSheet(builder, "MVA-koder", columns, rows);

  return toBuffer(builder);
}
