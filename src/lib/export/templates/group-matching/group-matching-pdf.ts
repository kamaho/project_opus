import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { GroupMatchingExportViewModel } from "../../types";
import { renderPdf } from "../../pdf/pdf-renderer";
import {
  coverPage,
  brandedReportHeader,
  reportFooter,
  statusBlock,
  dataTableWithFooter,
  formatNok,
  getRevizoLogoDataUrl,
} from "../../pdf/pdf-components";

export async function renderGroupMatchingPdf(
  vm: GroupMatchingExportViewModel
): Promise<Buffer> {
  const logoDataUrl = getRevizoLogoDataUrl();
  const logoKey = logoDataUrl ? "revizoLogo" : undefined;

  const images: Record<string, string> = {};
  if (logoDataUrl && logoKey) images[logoKey] = logoDataUrl;

  const content: Content[] = [];

  content.push(
    coverPage({
      reportTitle: "Grupperapport — Åpne poster",
      companyName: vm.groupName,
      klientNavn: `${vm.clientCount} klienter`,
      period: "Alle datoer",
      generatedBy: vm.generatedBy,
      generatedAt: vm.genererTidspunkt,
      logoImageKey: logoKey,
    })
  );

  // Aggregate summary page
  content.push(
    brandedReportHeader("Oppsummering", {
      companyName: vm.groupName,
      subtitle: `${vm.clientCount} klienter`,
    })
  );

  content.push(
    statusBlock([
      {
        label: "Totalt åpne poster (M1)",
        value: String(vm.totals.totalOpenSet1),
      },
      {
        label: "Totalt åpne poster (M2)",
        value: String(vm.totals.totalOpenSet2),
      },
      {
        label: "Total saldo M1",
        value: formatNok(vm.totals.totalSaldoSet1),
      },
      {
        label: "Total saldo M2",
        value: formatNok(vm.totals.totalSaldoSet2),
      },
      {
        label: "Differanse",
        value: formatNok(vm.totals.totalSaldoSet1 + vm.totals.totalSaldoSet2),
        highlight:
          Math.abs(vm.totals.totalSaldoSet1 + vm.totals.totalSaldoSet2) < 0.01,
      },
      {
        label: "Totalt matcher",
        value: String(vm.totals.totalMatches),
      },
    ])
  );

  // Overview table of all clients
  const overviewColumns = [
    { header: "Klient", width: "*", alignment: "left" as const },
    { header: "Åpne M1", width: 55, alignment: "right" as const },
    { header: "Åpne M2", width: 55, alignment: "right" as const },
    { header: "Saldo M1", width: 80, alignment: "right" as const },
    { header: "Saldo M2", width: 80, alignment: "right" as const },
    { header: "Avstemt", width: 45, alignment: "right" as const },
  ];

  const overviewRows = vm.sections.map((s) => [
    s.klientNavn,
    String(s.aapneSet1.length),
    String(s.aapneSet2.length),
    formatNok(s.saldoSet1),
    formatNok(s.saldoSet2),
    `${s.matchProsent}%`,
  ]);

  content.push({
    text: "Per klient",
    fontSize: 13,
    bold: true,
    margin: [0, 12, 0, 4],
  } as Content);

  content.push(
    dataTableWithFooter(
      overviewColumns,
      overviewRows,
      "Totalt:",
      formatNok(vm.totals.totalSaldoSet1 + vm.totals.totalSaldoSet2),
      { zebraStripe: true }
    )
  );

  // Per-client detail sections
  const txColumns = [
    { header: "Dato", width: 65, alignment: "left" as const },
    { header: "Bilag", width: 60, alignment: "left" as const },
    { header: "Beskrivelse", width: "*", alignment: "left" as const },
    { header: "Beløp", width: 80, alignment: "right" as const },
  ];

  const toRows = (txs: { dato: string; bilag: string; beskrivelse: string; belop: number }[]) =>
    txs.map((t) => [
      t.dato,
      t.bilag,
      t.beskrivelse,
      {
        text: formatNok(t.belop),
        color: t.belop < 0 ? "#cc0000" : "#000000",
      },
    ]);

  for (const section of vm.sections) {
    const hasOpen = section.aapneSet1.length > 0 || section.aapneSet2.length > 0;
    if (!hasOpen) continue;

    content.push({
      text: "",
      pageBreak: "before",
    } as Content);

    content.push(
      brandedReportHeader(section.klientNavn, {
        companyName: section.companyName,
        subtitle: `Avstemt: ${section.matchProsent}%`,
      })
    );

    content.push(
      statusBlock([
        { label: `${section.set1Label} — saldo`, value: formatNok(section.saldoSet1) },
        { label: `${section.set2Label} — saldo`, value: formatNok(section.saldoSet2) },
        { label: "Matcher", value: String(section.matchCount) },
      ])
    );

    if (section.aapneSet1.length > 0) {
      content.push({
        text: `${section.set1Label} — åpne (${section.aapneSet1.length})`,
        fontSize: 11,
        bold: true,
        margin: [0, 10, 0, 4],
      } as Content);
      content.push(
        dataTableWithFooter(
          txColumns,
          toRows(section.aapneSet1),
          "Totalt:",
          formatNok(section.totalSet1),
          { zebraStripe: true }
        )
      );
    }

    if (section.aapneSet2.length > 0) {
      content.push({
        text: `${section.set2Label} — åpne (${section.aapneSet2.length})`,
        fontSize: 11,
        bold: true,
        margin: [0, 10, 0, 4],
      } as Content);
      content.push(
        dataTableWithFooter(
          txColumns,
          toRows(section.aapneSet2),
          "Totalt:",
          formatNok(section.totalSet2),
          { zebraStripe: true }
        )
      );
    }
  }

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    images: Object.keys(images).length > 0 ? images : undefined,
    footer: reportFooter(vm.generatedBy ?? "System", vm.genererTidspunkt),
    content,
  };

  return renderPdf(doc);
}
