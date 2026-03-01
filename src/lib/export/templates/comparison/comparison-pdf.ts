import type { Content } from "pdfmake/interfaces";
import type { ComparisonExportViewModel } from "./comparison-viewmodel";
import { renderPdf } from "../../pdf/pdf-renderer";
import {
  coverPage,
  brandedReportHeader,
  reportFooter,
  dataTable,
  summaryBlock,
  formatNok,
  getRevizoLogoDataUrl,
} from "../../pdf/pdf-components";

export async function renderComparisonPdf(
  vm: ComparisonExportViewModel
): Promise<Buffer> {
  const logoDataUrl = getRevizoLogoDataUrl();
  const logoKey = logoDataUrl ? "revizoLogo" : undefined;

  const images: Record<string, string> = {};
  if (logoDataUrl && logoKey) images[logoKey] = logoDataUrl;

  const content: Content[] = [];

  content.push(
    coverPage({
      reportTitle: "Krysselskaplig saldosammenligning",
      period: `Generert ${new Date(vm.genererTidspunkt).toLocaleDateString("nb-NO")}`,
      generatedBy: vm.generatedBy,
      generatedAt: vm.genererTidspunkt,
      logoImageKey: logoKey,
    })
  );

  content.push(
    brandedReportHeader("Krysselskaplig saldosammenligning", {
      logoImageKey: logoKey,
      subtitle: `${vm.clients.length} klienter sammenlignet`,
      period: `Generert ${new Date(vm.genererTidspunkt).toLocaleDateString("nb-NO")}`,
    })
  );

  const columns = [
    { header: "Klient", width: "auto" as const },
    { header: "Selskap", width: "auto" as const },
    { header: "Konto", width: "auto" as const },
    { header: "Saldo hovedbok", width: "auto" as const, alignment: "right" as const },
    { header: "Saldo bank", width: "auto" as const, alignment: "right" as const },
    { header: "Åpne poster", width: "auto" as const, alignment: "right" as const },
  ];

  const bodyRows = vm.clients.map((c) => [
    c.name,
    c.companyName,
    c.set1AccountNumber,
    formatNok(c.balanceSet1),
    formatNok(c.balanceSet2),
    String(c.unmatchedCountSet1 + c.unmatchedCountSet2),
  ]);

  content.push(dataTable(columns, bodyRows, { zebraStripe: true }));

  content.push(
    summaryBlock([
      {
        label: "Netto hovedbok (sett 1)",
        value: formatNok(vm.totals.nettoSet1),
        bold: true,
        color: vm.totals.nettoSet1 === 0 ? "#16a34a" : "#dc2626",
      },
      {
        label: "Netto bank (sett 2)",
        value: formatNok(vm.totals.nettoSet2),
        bold: true,
        color: vm.totals.nettoSet2 === 0 ? "#16a34a" : "#dc2626",
      },
      {
        label: "Totalt åpne poster",
        value: String(vm.totals.totalUnmatchedCount),
      },
    ])
  );

  const footer = reportFooter(vm.generatedBy ?? "", vm.genererTidspunkt);

  const docDefinition = {
    pageSize: "A4" as const,
    pageOrientation: "landscape" as const,
    pageMargins: [40, 40, 40, 50] as [number, number, number, number],
    content,
    footer,
    images: Object.keys(images).length > 0 ? images : undefined,
    defaultStyle: { font: "Roboto", fontSize: 9 },
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 12, color: "#6b7280" },
    },
  };

  return renderPdf(docDefinition);
}
