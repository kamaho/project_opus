import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { MvaExportViewModel } from "../../types";
import { renderPdf } from "../../pdf/pdf-renderer";
import {
  coverPage,
  brandedReportHeader,
  reportFooter,
  reportMetaBlock,
  dataTable,
  summaryBlock,
  formatNok,
  formatDateTime,
  getRevizoLogoDataUrl,
} from "../../pdf/pdf-components";

export async function renderMvaPdf(vm: MvaExportViewModel): Promise<Buffer> {
  const logoDataUrl = getRevizoLogoDataUrl();
  const logoKey = logoDataUrl ? "revizoLogo" : undefined;

  const images: Record<string, string> = {};
  if (logoDataUrl && logoKey) images[logoKey] = logoDataUrl;
  if (vm.companyLogoDataUrl) images.brandLogo = vm.companyLogoDataUrl;

  const columns = [
    { header: "MVA-kode", width: 55, alignment: "left" as const },
    { header: "Beskrivelse", width: "*", alignment: "left" as const },
    { header: "Grunnlag", width: 70, alignment: "right" as const },
    { header: "Sats %", width: 40, alignment: "right" as const },
    { header: "Beregnet", width: 70, alignment: "right" as const },
    { header: "Bokført", width: 70, alignment: "right" as const },
    { header: "Diff", width: 60, alignment: "right" as const },
    { header: "Årsak", width: 70, alignment: "left" as const },
  ];

  const rows = vm.linjer.map((l) => [
    { text: l.mvaKode, bold: true },
    l.beskrivelse,
    formatNok(l.grunnlag),
    String(l.sats),
    formatNok(l.beregnet),
    formatNok(l.bokfort),
    {
      text: l.differanse === 0 ? "0" : formatNok(l.differanse),
      color: l.differanse !== 0 ? "#cc0000" : "#000000",
      bold: l.differanse !== 0,
    },
    l.aarsak || "—",
  ]);

  const comments = vm.linjer
    .filter((l) => l.kommentar)
    .map((l) => ({
      text: `Kode ${l.mvaKode}: ${l.kommentar}`,
      fontSize: 9,
      color: "#444444",
      margin: [0, 2, 0, 2] as [number, number, number, number],
    }));

  const metaRows: { label: string; value: string }[] = [
    { label: "Termin", value: vm.termin },
    { label: "Utskriftsdato", value: formatDateTime(vm.genererTidspunkt) },
  ];
  if (vm.generatedBy) metaRows.splice(1, 0, { label: "Skrevet ut av", value: vm.generatedBy });

  const content: Content[] = [
    coverPage({
      reportTitle: "MVA-avstemming",
      companyName: vm.companyName,
      klientNavn: `Termin ${vm.termin}`,
      generatedBy: vm.generatedBy,
      generatedAt: vm.genererTidspunkt,
      logoImageKey: logoKey,
    }),
    brandedReportHeader("MVA-avstemming", {
      companyName: vm.companyName,
      logoImageKey: vm.companyLogoDataUrl ? "brandLogo" : undefined,
      period: `Termin ${vm.termin}`,
    }),
    reportMetaBlock(metaRows),
    dataTable(columns, rows, { zebraStripe: true }),
    summaryBlock([
      { label: "Sum beregnet", value: formatNok(vm.totalBeregnet) },
      { label: "Sum bokført", value: formatNok(vm.totalBokfort) },
      {
        label: "Differanse",
        value: formatNok(vm.totalDifferanse),
        bold: true,
        color: vm.totalDifferanse !== 0 ? "#cc0000" : "#000000",
      },
    ]),
  ];

  if (comments.length > 0) {
    content.push({
      text: "Kommentarer",
      fontSize: 11,
      bold: true,
      margin: [0, 12, 0, 4] as [number, number, number, number],
    } as Content);
    content.push(...comments);
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    images: Object.keys(images).length > 0 ? images : undefined,
    footer: reportFooter(vm.generatedBy ?? "System", vm.genererTidspunkt),
    content,
  };

  return renderPdf(docDefinition);
}
