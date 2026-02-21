/**
 * Excel-import: leser .xlsx/.xls, mapper kolonner til transaksjoner.
 * Dato standardformat DD.MM.YYYY; støtter header-ekstraksjon (Kontonr fra header).
 */
import * as XLSX from "xlsx";
import type { ParsedTransaction, ParseResult, ExcelParserConfig, RowIssue } from "./types";

const EXCEL_EPOCH_OFFSET = 25569; // 1970-01-01 som Excel serial

function getCell(row: unknown[], col: number): unknown {
  if (!Array.isArray(row) || col < 0) return undefined;
  return row[col];
}

function cellToString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

function excelSerialToIso(serial: number): string {
  const d = new Date((serial - EXCEL_EPOCH_OFFSET) * 86400 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parser streng til ISO-dato ut fra angitt format. */
function parseDateString(value: string, format: string): string {
  const s = value.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const mapParts = (parts: string[], order: "dmy" | "ymd" | "mdy"): string => {
    if (parts.length < 3) return s;
    const [a, b, c] = parts.map((p) => p.padStart(2, "0"));
    if (order === "dmy") return `${c.length === 4 ? c : "20" + c}-${b}-${a}`;
    if (order === "ymd") return `${a}-${b}-${c}`;
    return `${c.length === 4 ? c : "20" + c}-${a}-${b}`;
  };

  const parts = s.split(/[./\-,\s]+/);
  const fmt = format.toUpperCase();
  if (fmt.includes("DD") && fmt.includes("MM") && fmt.includes("YYYY")) {
    const iD = fmt.indexOf("DD");
    const iM = fmt.indexOf("MM");
    const iY = fmt.indexOf("YYYY");
    if (iD < iM && iM < iY) return mapParts(parts, "dmy");
    if (iY < iM && iM < iD) return mapParts(parts, "ymd");
    if (iM < iD && iD < iY) return mapParts(parts, "mdy");
  }
  if (fmt === "YYYYMMDD" && s.length >= 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
}

function toIsoDate(
  value: unknown,
  dateFormat: string | undefined,
  field: string
): string {
  if (value == null || value === "") return "";
  const format = dateFormat ?? "DD.MM.YYYY";

  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    if (value > 10000 && value < 100000) return excelSerialToIso(value);
    return "";
  }
  return parseDateString(String(value), format);
}

function normalizeAmount(value: string): string {
  let s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  s = s.replace(/[^\d.-]/g, "");
  return s || "0";
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/**
 * Les Excel-fil fra buffer og returner første ark som rad-array (array av array).
 */
export function readExcelRows(buffer: ArrayBuffer, sheetIndex = 0): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;
  const name = sheetNames[sheetIndex] ?? sheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: "",
  }) as unknown[][];
}

export function parseExcel(buffer: ArrayBuffer, config: ExcelParserConfig): ParseResult {
  const errors: string[] = [];
  const rows = readExcelRows(buffer, config.sheetIndex ?? 0);
  const dataStart = config.dataStartRow;
  const columns = config.columns;
  const dateFormats = config.dateFormats ?? {};

  if (dataStart >= rows.length) {
    return { transactions: [], errors: ["Excel-filen har ingen datarader"] };
  }

  const headerRows = rows.slice(0, dataStart);
  const dataRows = rows.slice(dataStart) as unknown[][];

  const headerValues: Record<string, string> = {};
  for (const ext of config.headerExtractions ?? []) {
    const label = ext.label.trim();
    const offset = ext.columnOffset ?? 1;
    for (const row of headerRows) {
      const arr = Array.isArray(row) ? row : [];
      for (let c = 0; c < arr.length; c++) {
        const cell = String(arr[c] ?? "").trim();
        if (cell === label || cell.replace(/\s+$/, "") === label) {
          const valueCol = c + offset;
          headerValues[ext.field] = cellToString(arr[valueCol]);
          break;
        }
      }
    }
  }

  const transactions: ParsedTransaction[] = [];
  const skippedRows: RowIssue[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row)) continue;

    const rowNum = dataStart + i + 1;

    const get = (field: string): string => {
      const col = columns[field];
      if (col === undefined) {
        if (field === "accountNumber" && headerValues["Kontonr"]) return headerValues["Kontonr"];
        if (field === "accountNumber" && headerValues["accountNumber"]) return headerValues["accountNumber"];
        return "";
      }
      return cellToString(getCell(row, col));
    };

    const hasCredit = columns["credit"] !== undefined;
    const hasDebit = columns["debit"] !== undefined;
    const useCreditDebit = hasCredit && hasDebit;

    let amountNorm: string;
    if (useCreditDebit) {
      const creditRaw = normalizeAmount(get("credit"));
      const debitRaw = normalizeAmount(get("debit"));
      const creditVal = parseFloat(creditRaw) || 0;
      const debitVal = parseFloat(debitRaw) || 0;
      const net = debitVal - creditVal;
      if (Math.abs(net) < 0.005) continue;
      amountNorm = net.toFixed(2).replace(/\.?0+$/, "");
    } else {
      const amountRaw = get("amount");
      amountNorm = normalizeAmount(amountRaw);
      if (!amountNorm || amountNorm === "0") continue;
    }

    const date1 = toIsoDate(
      getCell(row, columns["date1"] ?? -1),
      dateFormats["date1"] ?? "DD.MM.YYYY",
      "date1"
    );

    if (!date1 || !isValidIsoDate(date1)) {
      const rawVal = cellToString(getCell(row, columns["date1"] ?? -1));
      const displayVal = rawVal.trim() || "(tom)";
      skippedRows.push({
        rowIndex: i,
        rowNumber: rowNum,
        field: "date1",
        value: displayVal,
        reason: !rawVal.trim()
          ? "Datofeltet er tomt"
          : `«${displayVal}» er ikke en gyldig dato`,
      });
      errors.push(`Rad ${rowNum}: ugyldig dato «${displayVal}» — raden ble hoppet over`);
      continue;
    }

    const tx: ParsedTransaction = {
      amount: amountNorm,
      date1,
      accountNumber: get("accountNumber") || headerValues["Kontonr"] || headerValues["accountNumber"] || undefined,
      reference: get("reference") || undefined,
      description: get("description") || undefined,
      textCode: get("textCode") || undefined,
      currency: get("currency") || undefined,
      foreignAmount: get("foreignAmount") || undefined,
      dim1: get("dim1") || undefined,
      dim2: get("dim2") || undefined,
      dim3: get("dim3") || undefined,
      dim4: get("dim4") || undefined,
      dim5: get("dim5") || undefined,
      dim6: get("dim6") || undefined,
      dim7: get("dim7") || undefined,
      dim8: get("dim8") || undefined,
      dim9: get("dim9") || undefined,
      dim10: get("dim10") || undefined,
      date2: get("date2") || undefined,
      buntref: get("buntref") || undefined,
      notat: get("notat") || undefined,
      bilag: get("bilag") || undefined,
      faktura: get("faktura") || undefined,
      forfall: get("forfall") || undefined,
      periode: get("periode") || undefined,
      importNumber: get("importNumber") || undefined,
      avgift: get("avgift") || undefined,
      tilleggstekst: get("tilleggstekst") || undefined,
      ref2: get("ref2") || undefined,
      ref3: get("ref3") || undefined,
      ref4: get("ref4") || undefined,
      ref5: get("ref5") || undefined,
      ref6: get("ref6") || undefined,
      anleggsnr: get("anleggsnr") || undefined,
      anleggsbeskrivelse: get("anleggsbeskrivelse") || undefined,
      bilagsart: get("bilagsart") || undefined,
      avsnr: get("avsnr") || undefined,
      tid: get("tid") || undefined,
      avvikendeDato: get("avvikendeDato") || undefined,
      rate: get("rate") || undefined,
      kundenavn: get("kundenavn") || undefined,
      kontonummerBokføring: get("kontonummerBokføring") || undefined,
    };
    if (!tx.accountNumber) delete tx.accountNumber;
    if (!tx.reference) delete tx.reference;
    if (!tx.description) delete tx.description;
    if (!tx.textCode) delete tx.textCode;
    if (!tx.currency) delete tx.currency;
    if (!tx.foreignAmount) delete tx.foreignAmount;

    if (useCreditDebit) {
      tx.sign = parseFloat(amountNorm) >= 0 ? "+" : "-";
    } else {
      const signCol = get("sign");
      if (signCol === "+" || signCol === "-") tx.sign = signCol;
    }

    transactions.push(tx);
  }

  return { transactions, errors, skippedRows };
}

/** Metadata for forhåndsvisning og kolonnemapping (samme idé som CSV). */
export interface ExcelColumnMeta {
  colIndex: number;
  header: string;
  samples: string[];
  suggestedField: string;
  dateFormat: string;
}

export interface ExcelFileMeta {
  fileName: string;
  columns: ExcelColumnMeta[];
  previewRows: string[][];
  dataStartRow: number;
  /** Første N rader fra arket (for å velge header-rad ved klikk). */
  rawSheetRows: string[][];
}

function rowToStrArray(row: unknown[], maxCol: number): string[] {
  const out: string[] = [];
  for (let c = 0; c <= maxCol; c++) {
    const v = getCell(row, c);
    if (v instanceof Date) out.push(v.toISOString().slice(0, 10));
    else if (v != null && v !== "") out.push(String(v).trim());
    else out.push("");
  }
  return out;
}

/**
 * Les Excel til metadata for forhåndsvisning: kolonner med forslog og preview-rader.
 * dataStartRow: 0-basert rad der dataradene starter (header-rad er da dataStartRow - 1).
 */
const RAW_SHEET_ROW_LIMIT = 35;

export function parseExcelToMeta(
  buffer: ArrayBuffer,
  fileName: string,
  options: { dataStartRow?: number; sheetIndex?: number }
): ExcelFileMeta {
  const dataStartRow = options.dataStartRow ?? 0;
  const rows = readExcelRows(buffer, options.sheetIndex ?? 0);
  const maxCol = Math.max(
    ...rows.map((r) => (Array.isArray(r) ? r.length : 0)),
    1
  );
  const colCount = Math.max(maxCol, 1);

  const rawSheetRows = rows
    .slice(0, RAW_SHEET_ROW_LIMIT)
    .map((r) => rowToStrArray(Array.isArray(r) ? r : [], maxCol - 1));

  const dataRows = rows.slice(dataStartRow) as unknown[][];
  const headerRow = dataStartRow > 0 ? (rows[dataStartRow - 1] as unknown[]) : [];
  const dataMaxCol = Math.max(
    ...dataRows.map((r) => (Array.isArray(r) ? r.length : 0)),
    Array.isArray(headerRow) ? headerRow.length : 0
  );
  const dataColCount = Math.max(dataMaxCol, 1);

  const columns: ExcelColumnMeta[] = [];
  for (let c = 0; c < dataColCount; c++) {
    const header =
      (Array.isArray(headerRow) && headerRow[c] != null
        ? String(headerRow[c]).trim()
        : null) || `Kolonne ${c + 1}`;
    const samples = dataRows
      .slice(0, 6)
      .map((r) => cellToString(getCell(Array.isArray(r) ? r : [], c)))
      .filter((s) => s !== "");
    const detectedType = detectDataTypeFromSamples(samples);
    const suggestedField = guessFieldFromSamples(header, samples, detectedType);
    const dateFormat =
      detectedType === "date" ? detectDateFormatFromSamples(samples) : "DD.MM.YYYY";
    columns.push({
      colIndex: c,
      header,
      samples,
      suggestedField,
      dateFormat,
    });
  }

  const previewRows = dataRows.slice(0, 100).map((r) => rowToStrArray(Array.isArray(r) ? r : [], dataMaxCol - 1));

  return {
    fileName,
    columns,
    previewRows,
    dataStartRow,
    rawSheetRows,
  };
}

function detectDataTypeFromSamples(samples: string[]): "date" | "number" | "text" {
  const nonEmpty = samples.filter((s) => s.trim() !== "");
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every((s) => /^\d{2}\.\d{2}\.\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{2}\/\d{2}\/\d{4}$/.test(s))) return "date";
  if (nonEmpty.every((s) => !Number.isNaN(parseFloat(s.replace(",", ".").replace(/\s/g, ""))))) return "number";
  return "text";
}

function detectDateFormatFromSamples(samples: string[]): string {
  const s = samples.find((x) => x.trim() !== "");
  if (!s) return "DD.MM.YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "YYYY-MM-DD";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return "DD/MM/YYYY";
  if (/^\d{8}$/.test(s)) return "YYYYMMDD";
  return "DD.MM.YYYY";
}

/** Returnerer alltid tom streng – brukeren mapper kolonner selv, ingen antagelser. */
function guessFieldFromSamples(
  _header: string,
  _samples: string[],
  _detectedType: "date" | "number" | "text"
): string {
  return "";
}
