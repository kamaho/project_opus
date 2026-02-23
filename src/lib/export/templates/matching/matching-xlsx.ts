import type { MatchingExportViewModel } from "../../types";
import { createWorkbook, toBuffer } from "../../xlsx/xlsx-renderer";
import { addSummarySheet, addDataSheet } from "../../xlsx/xlsx-components";

export function renderMatchingXlsx(vm: MatchingExportViewModel): Buffer {
  const builder = createWorkbook();

  if (vm.reportType === "open") {
    return renderOpenXlsx(builder, vm);
  }
  return renderClosedXlsx(builder, vm);
}

function renderOpenXlsx(
  builder: ReturnType<typeof createWorkbook>,
  vm: MatchingExportViewModel
): Buffer {
  addSummarySheet(builder, "Sammendrag", [
    { label: "Rapport", value: "Åpne poster" },
    { label: "Klient", value: vm.klientNavn },
    { label: "Periode", value: vm.datoPeriode },
    { label: `${vm.set1Label} — antall`, value: vm.antallSet1 ?? 0 },
    { label: `${vm.set1Label} — total`, value: vm.totalSet1 ?? 0 },
    { label: `${vm.set2Label} — antall`, value: vm.antallSet2 ?? 0 },
    { label: `${vm.set2Label} — total`, value: vm.totalSet2 ?? 0 },
    { label: "Generert", value: vm.genererTidspunkt.slice(0, 10) },
  ]);

  const txColumns = [
    { header: "Dato", width: 12 },
    { header: "Bilag", width: 12 },
    { header: "Beskrivelse", width: 35 },
    { header: "Beløp", width: 15, numFmt: "#,##0.00" },
  ];

  if ((vm.aapneSet1?.length ?? 0) > 0) {
    addDataSheet(
      builder,
      vm.set1Label.slice(0, 31),
      txColumns,
      vm.aapneSet1!.map((t) => [t.dato, t.bilag, t.beskrivelse, t.belop])
    );
  }

  if ((vm.aapneSet2?.length ?? 0) > 0) {
    addDataSheet(
      builder,
      vm.set2Label.slice(0, 31),
      txColumns,
      vm.aapneSet2!.map((t) => [t.dato, t.bilag, t.beskrivelse, t.belop])
    );
  }

  return toBuffer(builder);
}

function renderClosedXlsx(
  builder: ReturnType<typeof createWorkbook>,
  vm: MatchingExportViewModel
): Buffer {
  addSummarySheet(builder, "Sammendrag", [
    { label: "Rapport", value: "Lukkede poster" },
    { label: "Klient", value: vm.klientNavn },
    { label: "Periode", value: vm.datoPeriode },
    { label: "Antall matcher", value: vm.antallMatcher ?? 0 },
    { label: "Total matchet beløp", value: vm.totalMatchet ?? 0 },
    { label: "Generert", value: vm.genererTidspunkt.slice(0, 10) },
  ]);

  const matchColumns = [
    { header: "Match-dato", width: 12 },
    { header: "Type", width: 10 },
    { header: "Differanse", width: 14, numFmt: "#,##0.00" },
    { header: `${vm.set1Label} transaksjoner`, width: 40 },
    { header: `${vm.set2Label} transaksjoner`, width: 40 },
  ];

  const rows = (vm.matcher ?? []).map((m) => {
    const s1 = m.transaksjonerSet1.map((t) => `${t.dato} ${t.belop}`).join("; ");
    const s2 = m.transaksjonerSet2.map((t) => `${t.dato} ${t.belop}`).join("; ");
    return [
      m.matchDato,
      m.type === "auto" ? "Auto" : "Manuell",
      m.differanse,
      s1 || "—",
      s2 || "—",
    ];
  });

  addDataSheet(builder, "Matcher", matchColumns, rows);

  return toBuffer(builder);
}
