import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { MatchingExportViewModel } from "../../types";
import { renderPdf } from "../../pdf/pdf-renderer";
import {
  brandedReportHeader,
  reportFooter,
  reportMetaBlock,
  dataTable,
  dataTableWithFooter,
  summaryBlock,
  formatNok,
  formatDateTime,
} from "../../pdf/pdf-components";

export async function renderMatchingPdf(
  vm: MatchingExportViewModel
): Promise<Buffer> {
  if (vm.reportType === "open") return renderOpenPdf(vm);
  return renderClosedPdf(vm);
}

// ── Open items report ──────────────────────────────────────────────

async function renderOpenPdf(vm: MatchingExportViewModel): Promise<Buffer> {
  const txColumns = [
    { header: "Dato", width: 65, alignment: "left" as const },
    { header: "Bilag", width: 60, alignment: "left" as const },
    { header: "Beskrivelse", width: "*", alignment: "left" as const },
    { header: "Beløp", width: 80, alignment: "right" as const },
  ];

  const toRows = (txs: typeof vm.aapneSet1) =>
    (txs ?? []).map((t) => [
      t.dato,
      t.bilag,
      t.beskrivelse,
      { text: formatNok(t.belop), color: t.belop < 0 ? "#cc0000" : "#000000" },
    ]);

  const metaRows: { label: string; value: string }[] = [
    { label: "Per", value: vm.datoPeriode },
    { label: "Klient", value: vm.klientNavn },
  ];
  if (vm.generatedBy) metaRows.push({ label: "Skrevet ut av", value: vm.generatedBy });
  metaRows.push({ label: "Utskriftsdato", value: formatDateTime(vm.genererTidspunkt) });

  const content: Content[] = [
    brandedReportHeader("Åpne poster rapport", {
      companyName: vm.companyName,
      logoImageKey: vm.companyLogoDataUrl ? "brandLogo" : undefined,
      subtitle: vm.klientNavn,
      period: vm.datoPeriode,
    }),
    reportMetaBlock(metaRows),
    summaryBlock([
      { label: `${vm.set1Label} — antall`, value: String(vm.antallSet1 ?? 0) },
      { label: `${vm.set1Label} — total`, value: formatNok(vm.totalSet1 ?? 0) },
      { label: `${vm.set2Label} — antall`, value: String(vm.antallSet2 ?? 0) },
      { label: `${vm.set2Label} — total`, value: formatNok(vm.totalSet2 ?? 0) },
    ]),
  ];

  if ((vm.aapneSet1?.length ?? 0) > 0) {
    content.push({
      text: vm.set1Label,
      fontSize: 12,
      bold: true,
      margin: [0, 12, 0, 4],
    } as Content);
    content.push(
      dataTableWithFooter(
        txColumns,
        toRows(vm.aapneSet1),
        `${vm.set1Label}. Totalt:`,
        formatNok(vm.totalSet1 ?? 0),
        { zebraStripe: true }
      )
    );
  }

  if ((vm.aapneSet2?.length ?? 0) > 0) {
    content.push({
      text: vm.set2Label,
      fontSize: 12,
      bold: true,
      margin: [0, 16, 0, 4],
    } as Content);
    content.push(
      dataTableWithFooter(
        txColumns,
        toRows(vm.aapneSet2),
        `${vm.set2Label}. Totalt:`,
        formatNok(vm.totalSet2 ?? 0),
        { zebraStripe: true }
      )
    );
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    images: vm.companyLogoDataUrl ? { brandLogo: vm.companyLogoDataUrl } : undefined,
    footer: reportFooter(vm.generatedBy ?? "System", vm.genererTidspunkt),
    content,
  };

  return renderPdf(doc);
}

// ── Closed items report ────────────────────────────────────────────

async function renderClosedPdf(vm: MatchingExportViewModel): Promise<Buffer> {
  const metaRows: { label: string; value: string }[] = [
    { label: "Per", value: vm.datoPeriode },
    { label: "Klient", value: vm.klientNavn },
  ];
  if (vm.generatedBy) metaRows.push({ label: "Skrevet ut av", value: vm.generatedBy });
  metaRows.push({ label: "Utskriftsdato", value: formatDateTime(vm.genererTidspunkt) });

  const content: Content[] = [
    brandedReportHeader("Lukkede poster rapport", {
      companyName: vm.companyName,
      logoImageKey: vm.companyLogoDataUrl ? "brandLogo" : undefined,
      subtitle: vm.klientNavn,
      period: vm.datoPeriode,
    }),
    reportMetaBlock(metaRows),
    summaryBlock([
      { label: "Antall matcher", value: String(vm.antallMatcher ?? 0) },
      { label: "Total matchet beløp", value: formatNok(vm.totalMatchet ?? 0) },
    ]),
  ];

  const matchColumns = [
    { header: "Match-dato", width: 65, alignment: "left" as const },
    { header: "Type", width: 50, alignment: "left" as const },
    { header: "Diff", width: 55, alignment: "right" as const },
    { header: `${vm.set1Label}`, width: "*", alignment: "left" as const },
    { header: `${vm.set2Label}`, width: "*", alignment: "left" as const },
  ];

  const rows = (vm.matcher ?? []).map((m) => {
    const set1Text = m.transaksjonerSet1
      .map((t) => `${t.dato} ${formatNok(t.belop)}`)
      .join("\n");
    const set2Text = m.transaksjonerSet2
      .map((t) => `${t.dato} ${formatNok(t.belop)}`)
      .join("\n");
    return [
      m.matchDato,
      m.type === "auto" ? "Auto" : "Manuell",
      {
        text: m.differanse === 0 ? "0" : formatNok(m.differanse),
        color: m.differanse !== 0 ? "#cc0000" : "#000000",
      },
      { text: set1Text || "—", fontSize: 8 },
      { text: set2Text || "—", fontSize: 8 },
    ];
  });

  if (rows.length > 0) {
    content.push(dataTable(matchColumns, rows, { zebraStripe: true }));
  } else {
    content.push({
      text: "Ingen lukkede poster i valgt periode.",
      fontSize: 10,
      color: "#666666",
      margin: [0, 12, 0, 0],
    } as Content);
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    images: vm.companyLogoDataUrl ? { brandLogo: vm.companyLogoDataUrl } : undefined,
    footer: reportFooter(vm.generatedBy ?? "System", vm.genererTidspunkt),
    content,
  };

  return renderPdf(doc);
}
