/**
 * Leser CSV-fil til metadata og forhåndsvisning med forslog til felt-mapping.
 * Bruker detectors for skilletegn, datoformat og guessField.
 */

import Papa from "papaparse";
import type { ParsedFileMeta } from "./types";
import {
  detectDataType,
  detectDateFormat,
  detectSeparator,
  detectTextQualifier,
  guessField,
} from "./detectors";
import type { ColumnMapping, SeparatorChar } from "./types";

const MAX_SAMPLE_ROWS = 6;
const PREVIEW_MAX_ROWS = 20;

export interface ParseCsvToMetaOptions {
  /** Overstyr skilletegn (f.eks. ved brukervalg) */
  delimiter?: SeparatorChar;
}

/**
 * Parser CSV-tekst til metadata med kolonner og forhåndsvisning.
 * Brukes for å foreslå kolonne-mapping (date1, amount, reference, description) før import.
 */
export function parseCsvToMeta(
  text: string,
  fileName: string,
  options?: ParseCsvToMetaOptions
): ParsedFileMeta {
  const firstLine = text.split("\n")[0] ?? "";
  const separator = options?.delimiter ?? detectSeparator(firstLine);
  const { has: hasTextQualifier, char: textQualifier } =
    detectTextQualifier(text);

  const parseResult = Papa.parse<string[]>(text, {
    delimiter: separator === "\t" ? "\t" : separator,
    quoteChar: textQualifier || '"',
    header: false,
    preview: PREVIEW_MAX_ROWS + 1,
    skipEmptyLines: true,
  });

  const rows = (parseResult.data ?? []) as string[][];
  if (rows.length === 0) {
    return {
      fileName,
      columns: [],
      separator,
      hasTextQualifier,
      textQualifier,
      hasHeaderRow: true,
      previewHeaders: [],
      previewRows: [],
    };
  }

  const headerRow = rows[0] ?? [];
  const dataRows = rows.slice(1);

  const columns: ColumnMapping[] = headerRow.map((header, colIdx) => {
    const rawSamples = dataRows
      .map((row) => row[colIdx] ?? "")
      .filter((s) => s.trim() !== "")
      .slice(0, MAX_SAMPLE_ROWS);

    const dateResult = detectDateFormat(rawSamples);
    const detectedType = detectDataType(rawSamples);
    const suggestedField = guessField(header.trim());

    return {
      colIndex: colIdx,
      header: header.trim() || `Kolonne ${colIdx + 1}`,
      samples: rawSamples,
      detectedType,
      detectedDateFormat: dateResult.format,
      suggestedField,
      dateFormat: dateResult.format,
    };
  });

  // Fyll inn date1/amount fra datatype når header ikke ga treff (riktig kolonne)
  inferMissingColumnMapping(columns);

  const previewHeaders = headerRow.map((h: string) => String(h).trim());
  const previewRows = dataRows.map((row: string[]) =>
    row.map((c: string) => String(c ?? ""))
  );

  return {
    fileName,
    columns,
    separator,
    hasTextQualifier,
    textQualifier,
    hasHeaderRow: true,
    previewHeaders,
    previewRows,
  };
}

/** Setter suggestedField på kolonner ut fra datatype når header ikke matchet (date → date1, number → amount). */
function inferMissingColumnMapping(columns: ColumnMapping[]): void {
  type InternalFieldKey = import("./types").InternalFieldKey;
  const has = (field: InternalFieldKey) =>
    columns.some((c) => c.suggestedField === field);

  if (!has("date1")) {
    const firstDate = columns.find(
      (c) => (c.detectedType === "date" || c.detectedDateFormat) && !c.suggestedField
    );
    if (firstDate) firstDate.suggestedField = "date1";
  }
  if (!has("amount")) {
    const firstAmount = columns.find(
      (c) => c.detectedType === "number" && !c.suggestedField
    );
    if (firstAmount) firstAmount.suggestedField = "amount";
  }
  if (!has("reference")) {
    const firstText = columns.find(
      (c) => c.detectedType === "text" && !c.suggestedField
    );
    if (firstText) firstText.suggestedField = "reference";
  }
  if (!has("description")) {
    const desc = columns.find(
      (c) =>
        c.suggestedField === "" &&
        (c.detectedType === "text" || c.header.length > 2)
    );
    if (desc) desc.suggestedField = "description";
  }
}

/**
 * Bygger CsvParserConfig fra ParsedFileMeta (suggestedField + infererte kolonner).
 * Kolonneindeks er 0-basert. Sørger alltid for minst date1 og amount (fallback 0 og 1).
 */
export function metaToCsvConfig(
  meta: ParsedFileMeta,
  decimalSeparator: "." | "," = ","
): { columns: Record<string, number>; delimiter: string } {
  const columns: Record<string, number> = {};
  for (const col of meta.columns) {
    if (col.suggestedField && col.suggestedField !== "none") {
      columns[col.suggestedField] = col.colIndex;
    }
  }
  // Fallback slik at parser alltid har date1 og amount
  if (columns.date1 === undefined) {
    const dateCol = meta.columns.find(
      (c) => c.suggestedField === "date1" || c.detectedType === "date"
    );
    columns.date1 = dateCol?.colIndex ?? 0;
  }
  if (columns.amount === undefined) {
    const amountCol = meta.columns.find(
      (c) => c.suggestedField === "amount" || c.detectedType === "number"
    );
    columns.amount = amountCol?.colIndex ?? 1;
  }
  return {
    columns,
    delimiter: meta.separator,
  };
}
