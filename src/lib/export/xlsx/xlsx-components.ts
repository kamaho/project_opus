import * as XLSX from "xlsx";
import type { WorkbookBuilder } from "./xlsx-renderer";

// ── Summary sheet (key-value pairs) ────────────────────────────────

export function addSummarySheet(
  builder: WorkbookBuilder,
  sheetName: string,
  items: { label: string; value: string | number }[]
): void {
  const data = items.map((item) => [item.label, item.value]);
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!cols"] = [{ wch: 30 }, { wch: 25 }];

  XLSX.utils.book_append_sheet(builder.wb, ws, sheetName);
}

// ── Data sheet (headers + rows) ────────────────────────────────────

export interface ColumnFormat {
  header: string;
  width?: number;
  numFmt?: string;
}

export function addDataSheet(
  builder: WorkbookBuilder,
  sheetName: string,
  columns: ColumnFormat[],
  rows: (string | number | null | undefined)[][]
): void {
  const headerRow = columns.map((c) => c.header);
  const data = [headerRow, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 15 }));

  // Freeze the header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  // Auto-filter on header row
  if (rows.length > 0) {
    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: columns.length - 1 },
      }),
    };
  }

  // Apply number formats to data cells
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const fmt = columns[C]?.numFmt;
      if (!fmt) continue;
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.z = fmt;
      }
    }
  }

  XLSX.utils.book_append_sheet(builder.wb, ws, sheetName);
}
