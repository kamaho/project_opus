export * from "./types";
export { parseCsv, readCsvRawRows } from "./csv-parser";
export { parseCamt } from "./camt-parser";
export { parseKlink, parseKlinkSpec } from "./klink-parser";
export {
  parseExcel,
  parseExcelToMeta,
  readExcelRows,
  type ExcelFileMeta,
  type ExcelColumnMeta,
} from "./excel-parser";

/**
 * Read a File as text with automatic encoding detection.
 * Tries UTF-8 first; falls back to ISO-8859-1 if replacement chars appear
 * (common for Norwegian files with æ, ø, å from legacy systems).
 */
export async function readFileAsText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("iso-8859-1").decode(buf);
  }
  return utf8;
}

/**
 * Decode an ArrayBuffer/Uint8Array to text with automatic encoding detection.
 */
export function decodeTextBuffer(buf: ArrayBuffer | Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("iso-8859-1").decode(buf);
  }
  return utf8;
}

import type { ParserFileType, ParseResult } from "./types";
import { parseCsv } from "./csv-parser";
import { parseCamt } from "./camt-parser";
import { parseKlink } from "./klink-parser";
import type { CsvParserConfig, KlinkParserConfig } from "./types";

export function parseFile(
  content: string,
  fileType: "csv" | "camt" | "klink",
  config?: CsvParserConfig | KlinkParserConfig
): ParseResult {
  if (fileType === "camt") {
    return parseCamt(content);
  }
  if (fileType === "csv" && config && "delimiter" in config) {
    return parseCsv(content, config as CsvParserConfig);
  }
  if (fileType === "klink" && config && "spec" in config) {
    return parseKlink(content, config as KlinkParserConfig);
  }
  return {
    transactions: [],
    errors: ["Unsupported file type or missing config"],
  };
}

export function detectFileType(filename: string): ParserFileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xml") || lower.endsWith(".camt")) return "camt";
  if (lower.endsWith(".txt")) return "csv"; // .txt behandles som CSV med innholdsjekk
  return null;
}

/**
 * Gjenkjenner filtype fra filnavn og evt. innhold (for .txt eller ukjent).
 * Bruk ved drop: await detectFileTypeFromFile(file) → "csv" | "camt".
 */
export async function detectFileTypeFromFile(
  file: File
): Promise<"csv" | "camt" | "klink" | "excel"> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xml") || name.endsWith(".camt")) return "camt";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "excel";

  const blob = file.slice(0, 8000);
  const text = await blob.text();
  if (/<\?xml|xmlns=.*camt\.053|camt\.054/i.test(text)) return "camt";
  if (/^1[0-7][0-9]\d{5,}/m.test(text) && !/[,;\t]/.test(text.slice(0, 500))) return "klink";
  return "csv";
}
