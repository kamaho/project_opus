import type {
  Content,
  ContentTable,
  DynamicContent,
} from "pdfmake/interfaces";

// ── Formatting ─────────────────────────────────────────────────────

export function formatNok(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Report header ──────────────────────────────────────────────────

export function reportHeader(
  title: string,
  subtitle?: string,
  period?: string
): Content {
  const items: Content[] = [
    { text: title, fontSize: 16, bold: true, margin: [0, 0, 0, 2] },
  ];
  if (subtitle) {
    items.push({
      text: subtitle,
      fontSize: 10,
      color: "#666666",
      margin: [0, 0, 0, 1],
    });
  }
  if (period) {
    items.push({
      text: `Periode: ${period}`,
      fontSize: 10,
      color: "#666666",
      margin: [0, 0, 0, 0],
    });
  }
  items.push({
    canvas: [{ type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: "#cccccc" }],
    margin: [0, 4, 0, 8],
  } as Content);
  return { stack: items, margin: [0, 0, 0, 8] };
}

/** Branded header: logo (optional) + company name + report title. Caller must add logo to docDefinition.images when logoImageKey is set. */
export function brandedReportHeader(
  reportTitle: string,
  opts: {
    companyName?: string;
    logoImageKey?: string;
    subtitle?: string;
    period?: string;
  } = {}
): Content {
  const { companyName, logoImageKey, subtitle, period } = opts;
  const left: Content[] = [];

  if (logoImageKey) {
    left.push({
      image: logoImageKey,
      width: 48,
      margin: [0, 0, 0, 4],
    });
  }
  if (companyName) {
    left.push({
      text: companyName,
      fontSize: 12,
      bold: true,
      color: "#333333",
      margin: [0, 0, 0, 2],
    });
  }
  left.push({
    text: reportTitle,
    fontSize: 16,
    bold: true,
    margin: [0, 2, 0, 0],
  });
  if (subtitle) {
    left.push({
      text: subtitle,
      fontSize: 10,
      color: "#666666",
      margin: [0, 2, 0, 0],
    });
  }
  if (period) {
    left.push({
      text: `Per: ${period}`,
      fontSize: 10,
      color: "#666666",
      margin: [0, 0, 0, 0],
    });
  }
  left.push({
    canvas: [{ type: "line", x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: "#cccccc" }],
    margin: [0, 6, 0, 8],
  } as Content);
  return { stack: left, margin: [0, 0, 0, 8] };
}

/** Metadata-blokk (Per, Skrevet ut av, Utskriftsdato, Klient) i to kolonner. */
export function reportMetaBlock(rows: { label: string; value: string }[]): Content {
  if (rows.length === 0) return { text: "" };
  const body = rows.map((r) => [
    { text: `${r.label}:`, fontSize: 9, color: "#666666", margin: [0, 1, 8, 1] },
    { text: r.value, fontSize: 9, color: "#000000", margin: [0, 1, 0, 1] },
  ]);
  return {
    margin: [0, 0, 0, 10],
    table: {
      widths: ["auto", "*"],
      body,
    },
    layout: "noBorders",
  } as Content;
}

// ── Report footer (dynamic, renders on every page) ────────────────

export function reportFooter(
  generatedBy: string,
  generatedAt: string
): DynamicContent {
  return (currentPage, pageCount) => ({
    columns: [
      {
        text: `Generert: ${formatDate(generatedAt)} av ${generatedBy}`,
        fontSize: 8,
        color: "#999999",
        margin: [40, 0, 0, 0],
      },
      {
        text: `Side ${currentPage} av ${pageCount}`,
        fontSize: 8,
        color: "#999999",
        alignment: "right" as const,
        margin: [0, 0, 40, 0],
      },
    ],
    margin: [0, 10, 0, 0],
  });
}

// ── Data table ─────────────────────────────────────────────────────

interface DataTableColumn {
  header: string;
  width?: number | string;
  alignment?: "left" | "center" | "right";
}

export function dataTable(
  columns: DataTableColumn[],
  rows: unknown[][],
  opts?: { zebraStripe?: boolean }
): Content {
  const headerRow = columns.map((col) => ({
    text: col.header,
    bold: true,
    fontSize: 9,
    color: "#333333",
    fillColor: "#f5f5f5",
    alignment: col.alignment ?? ("left" as const),
    margin: [4, 6, 4, 6] as [number, number, number, number],
  }));

  const bodyRows = rows.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      const base =
        typeof cell === "object" && cell !== null && "text" in cell
          ? { ...(cell as Record<string, unknown>) }
          : { text: String(cell ?? "") };
      return {
        fontSize: 9,
        margin: [4, 4, 4, 4] as [number, number, number, number],
        alignment: columns[colIdx]?.alignment ?? ("left" as const),
        fillColor:
          opts?.zebraStripe && rowIdx % 2 === 1 ? "#fafafa" : undefined,
        ...base,
      };
    })
  );

  return {
    table: {
      headerRows: 1,
      widths: columns.map((c) => c.width ?? "*"),
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => "#e0e0e0",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as Content;
}

/** Tabell med én totalrad nederst (f.eks. "Set 1. Totalt:" og beløp). */
export function dataTableWithFooter(
  columns: DataTableColumn[],
  rows: unknown[][],
  footerLabel: string,
  footerValue: string,
  opts?: { zebraStripe?: boolean }
): Content {
  const headerRow = columns.map((col) => ({
    text: col.header,
    bold: true,
    fontSize: 9,
    color: "#333333",
    fillColor: "#f5f5f5",
    alignment: col.alignment ?? ("left" as const),
    margin: [4, 6, 4, 6] as [number, number, number, number],
  }));

  const bodyRows = rows.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      const base =
        typeof cell === "object" && cell !== null && "text" in cell
          ? { ...(cell as Record<string, unknown>) }
          : { text: String(cell ?? "") };
      return {
        fontSize: 9,
        margin: [4, 4, 4, 4] as [number, number, number, number],
        alignment: columns[colIdx]?.alignment ?? ("left" as const),
        fillColor:
          opts?.zebraStripe && rowIdx % 2 === 1 ? "#fafafa" : undefined,
        ...base,
      };
    })
  );

  const footerRow: unknown[] = [
    {
      text: footerLabel,
      colSpan: columns.length - 1,
      bold: true,
      fontSize: 9,
      fillColor: "#f0f0f0",
      margin: [4, 6, 4, 6] as [number, number, number, number],
    },
    ...Array.from({ length: Math.max(0, columns.length - 2) }).map(() => ({})),
    {
      text: footerValue,
      bold: true,
      fontSize: 9,
      alignment: "right" as const,
      fillColor: "#f0f0f0",
      margin: [4, 6, 4, 6] as [number, number, number, number],
    },
  ];

  return {
    table: {
      headerRows: 1,
      widths: columns.map((c) => c.width ?? "*"),
      body: [headerRow, ...bodyRows, footerRow],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => "#e0e0e0",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as Content;
}

// ── Summary block (key-value pairs) ────────────────────────────────

export function summaryBlock(
  items: { label: string; value: string; bold?: boolean; color?: string }[]
): Content {
  return {
    margin: [0, 8, 0, 8],
    table: {
      widths: ["auto", "*"],
      body: items.map((item) => [
        { text: item.label, fontSize: 10, color: "#666666", margin: [0, 2, 8, 2] },
        {
          text: item.value,
          fontSize: 10,
          bold: item.bold ?? false,
          color: item.color ?? "#000000",
          alignment: "right" as const,
          margin: [0, 2, 0, 2],
        },
      ]),
    },
    layout: "noBorders",
  };
}

// ── Conclusion block ───────────────────────────────────────────────

export function conclusionBlock(text: string): Content {
  if (!text) return { text: "" };
  return {
    stack: [
      { text: "Konklusjon", fontSize: 11, bold: true, margin: [0, 8, 0, 4] },
      {
        text,
        fontSize: 10,
        color: "#333333",
        margin: [0, 0, 0, 8],
        lineHeight: 1.4,
      },
    ],
  };
}
