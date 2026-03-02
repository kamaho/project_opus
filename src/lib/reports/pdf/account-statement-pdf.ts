import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { renderPdf } from "@/lib/export/pdf/pdf-renderer";
import {
  brandedReportHeader,
  reportMetaBlock,
  formatNok,
  formatDate,
  getRevizoLogoDataUrl,
} from "@/lib/export/pdf/pdf-components";
import type { AgingRow } from "../view-types";

interface StatementInput {
  kundeId: string;
  kundeNavn: string;
  firmaNavn: string;
  aldersfordeltPer: string;
  rows: AgingRow[];
  totalSaldo: number;
}

export async function generateAccountStatementPdf(input: StatementInput): Promise<Buffer> {
  const logoDataUrl = getRevizoLogoDataUrl();

  const headerRow = [
    { text: "Ref.nr", bold: true, fontSize: 9, color: "#444444" },
    { text: "Dok", bold: true, fontSize: 9, color: "#444444" },
    { text: "Dok.dato", bold: true, fontSize: 9, color: "#444444" },
    { text: "Forfall", bold: true, fontSize: 9, color: "#444444" },
    { text: "Beløp", bold: true, fontSize: 9, color: "#444444", alignment: "right" as const },
  ];

  const bodyRows = input.rows.map((r, i) => [
    { text: r.ref, fontSize: 9, fillColor: i % 2 === 0 ? "#f9f9f9" : undefined },
    { text: r.dok, fontSize: 9, fillColor: i % 2 === 0 ? "#f9f9f9" : undefined },
    { text: formatDate(r.dokDato), fontSize: 9, fillColor: i % 2 === 0 ? "#f9f9f9" : undefined },
    { text: formatDate(r.forfallsDato), fontSize: 9, fillColor: i % 2 === 0 ? "#f9f9f9" : undefined },
    { text: formatNok(r.saldo) + " kr", fontSize: 9, alignment: "right" as const, fillColor: i % 2 === 0 ? "#f9f9f9" : undefined },
  ]);

  const footerRow = [
    { text: "Total", bold: true, fontSize: 9, colSpan: 4 },
    { text: "" },
    { text: "" },
    { text: "" },
    { text: formatNok(input.totalSaldo) + " kr", alignment: "right" as const, bold: true, fontSize: 9 },
  ];

  const table: Content = {
    table: {
      headerRows: 1,
      widths: ["auto", "auto", "auto", "auto", "*"],
      body: [headerRow, ...bodyRows, footerRow],
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
        i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.3,
      vLineWidth: () => 0,
      hLineColor: () => "#e0e0e0",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };

  const generatedStr = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    ...(logoDataUrl ? { images: { logo: logoDataUrl } } : {}),
    content: [
      brandedReportHeader("Kontoutskrift", {
        companyName: input.firmaNavn,
        subtitle: `${input.kundeId} – ${input.kundeNavn}`,
        ...(logoDataUrl ? { logoImageKey: "logo" } : {}),
      }),
      reportMetaBlock([
        { label: "Kunde", value: `${input.kundeId} – ${input.kundeNavn}` },
        { label: "Per dato", value: input.aldersfordeltPer },
        { label: "Generert", value: generatedStr },
      ]),
      { text: " ", margin: [0, 4, 0, 4] } as Content,
      table,
    ],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `Generert: ${generatedStr}`,
          fontSize: 8,
          color: "#999999",
          margin: [40, 0, 0, 0],
        },
        {
          text: `Side ${currentPage} / ${pageCount}`,
          alignment: "right" as const,
          fontSize: 8,
          color: "#999999",
          margin: [0, 0, 40, 0],
        },
      ],
      margin: [0, 0, 0, 0],
    }),
  };

  return renderPdf(docDefinition);
}
