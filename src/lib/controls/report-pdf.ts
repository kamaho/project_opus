import type { TDocumentDefinitions, Content, ContentTable } from "pdfmake/interfaces";
import { renderPdf } from "@/lib/export/pdf/pdf-renderer";
import { reportHeader, formatNok, formatDate } from "@/lib/export/pdf/pdf-components";
import type { ControlResult, AgingBucket, Severity } from "./types";
import { CONTROL_TYPE_LABELS, SEVERITY_LABELS } from "./types";

const SEVERITY_COLORS: Record<Severity, string> = {
  ok: "#22c55e",
  info: "#3b82f6",
  warning: "#f59e0b",
  error: "#ef4444",
};

const SEVERITY_SYMBOLS: Record<Severity, string> = {
  ok: "✓",
  info: "ℹ",
  warning: "⚠",
  error: "✗",
};

function formatDateObj(d: Date): string {
  return formatDate(d.toISOString());
}

interface StatusBadgeResult {
  text: string;
  bold: true;
  color: string;
}

function statusBadge(severity: Severity): StatusBadgeResult {
  const labels: Record<Severity, string> = {
    ok: "Ingen avvik",
    info: "Merknader",
    warning: "Avvik funnet",
    error: "Feil funnet",
  };
  return {
    text: `${SEVERITY_SYMBOLS[severity]} ${labels[severity]}`,
    bold: true,
    color: SEVERITY_COLORS[severity],
  };
}

export async function generateControlPdf(
  result: ControlResult,
  companyName: string
): Promise<Buffer> {
  const typeLabel = CONTROL_TYPE_LABELS[result.controlType] ?? result.controlType;
  const asOfDate = "asOfDate" in result.period
    ? formatDateObj(result.period.asOfDate)
    : `${result.period.year}${result.period.month ? `-${String(result.period.month).padStart(2, "0")}` : ""}`;

  const content: Content[] = [];

  // Header
  content.push(reportHeader(typeLabel, companyName, asOfDate));

  // Summary box
  content.push({
    margin: [0, 0, 0, 16],
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              { ...statusBadge(result.overallStatus), fontSize: 13, margin: [0, 0, 0, 6] },
              {
                columns: [
                  { text: `Poster sjekket: ${result.summary.totalChecked}`, fontSize: 9, width: "auto" },
                  { text: `Avvik: ${result.summary.totalDeviations}`, fontSize: 9, width: "auto", margin: [16, 0, 0, 0] },
                  { text: `Sum avvik: ${formatNok(result.summary.totalDeviationAmount)} kr`, fontSize: 9, width: "auto", margin: [16, 0, 0, 0] },
                ],
              },
              ...(result.metadata.totalOutstanding != null
                ? [
                    {
                      columns: [
                        { text: `Total utestående: ${formatNok(result.metadata.totalOutstanding as number)} kr`, fontSize: 9, width: "auto", margin: [0, 4, 0, 0] },
                        { text: `Herav forfalt: ${formatNok(result.metadata.totalOverdue as number)} kr (${result.metadata.overduePercentage}%)`, fontSize: 9, width: "auto", margin: [16, 4, 0, 0] },
                      ],
                    } as Content,
                  ]
                : []),
            ],
            margin: [8, 8, 8, 8],
          },
        ],
      ],
    },
    layout: {
      hLineColor: () => "#e5e7eb",
      vLineColor: () => "#e5e7eb",
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  } as Content);

  // Aging distribution
  const agingBuckets = result.metadata.agingBuckets as AgingBucket[] | undefined;
  if (agingBuckets?.length) {
    content.push({ text: "Aldersfordeling", fontSize: 12, bold: true, margin: [0, 0, 0, 6] });

    const agingTable: ContentTable = {
      table: {
        headerRows: 1,
        widths: ["*", 50, 100, 50],
        body: [
          [
            { text: "Intervall", bold: true, fontSize: 8, color: "#6b7280" },
            { text: "Antall", bold: true, fontSize: 8, color: "#6b7280", alignment: "right" },
            { text: "Beløp", bold: true, fontSize: 8, color: "#6b7280", alignment: "right" },
            { text: "%", bold: true, fontSize: 8, color: "#6b7280", alignment: "right" },
          ],
          ...agingBuckets.map((b) => [
            { text: b.label, fontSize: 9 },
            { text: String(b.count), fontSize: 9, alignment: "right" as const },
            { text: `${formatNok(b.totalAmount)} kr`, fontSize: 9, alignment: "right" as const, font: "Roboto" },
            { text: `${b.percentage}%`, fontSize: 9, alignment: "right" as const },
          ]),
        ],
      },
      layout: {
        hLineColor: () => "#e5e7eb",
        vLineColor: () => "#f3f4f6",
        hLineWidth: (i: number, node: ContentTable) =>
          i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25,
        vLineWidth: () => 0,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 16],
    };
    content.push(agingTable);
  }

  // Deviations
  if (result.deviations.length > 0) {
    content.push({ text: "Avvik", fontSize: 12, bold: true, margin: [0, 0, 0, 6] });

    for (const dev of result.deviations) {
      content.push({
        margin: [0, 0, 0, 6],
        columns: [
          {
            width: 14,
            text: SEVERITY_SYMBOLS[dev.severity],
            color: SEVERITY_COLORS[dev.severity],
            fontSize: 10,
            bold: true,
          },
          {
            width: "*",
            stack: [
              { text: dev.description, fontSize: 9 },
              ...(dev.reference && dev.reference !== "Total"
                ? [{ text: `Ref: ${dev.reference}`, fontSize: 8, color: "#9ca3af" }]
                : []),
            ],
          },
          {
            width: 80,
            text: `${formatNok(dev.amount)} kr`,
            fontSize: 9,
            alignment: "right" as const,
          },
        ],
      });
    }
  } else {
    content.push({
      text: "Ingen avvik funnet.",
      fontSize: 10,
      color: "#22c55e",
      margin: [0, 8, 0, 0],
    });
  }

  // Footer metadata
  content.push({
    margin: [0, 24, 0, 0],
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb" }],
  } as Content);
  content.push({
    text: [
      { text: "Kilde: ", color: "#9ca3af", fontSize: 8 },
      { text: result.sourceLabel || "Ukjent", fontSize: 8 },
      { text: "  |  Generert: ", color: "#9ca3af", fontSize: 8 },
      { text: formatDateObj(result.executedAt), fontSize: 8 },
    ],
    margin: [0, 6, 0, 0],
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    content,
  };

  return renderPdf(docDefinition);
}
