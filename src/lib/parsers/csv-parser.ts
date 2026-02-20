import Papa from "papaparse";
import type { ParsedTransaction, CsvParserConfig, ParseResult, RowIssue } from "./types";

const RAW_ROW_LIMIT = 50;

export function readCsvRawRows(content: string, maxRows = RAW_ROW_LIMIT): string[][] {
  const result = Papa.parse<string[]>(content, {
    delimiter: undefined,
    skipEmptyLines: true,
    preview: maxRows,
  });
  return (result.data as string[][]).slice(0, maxRows);
}

const INTERNAL_FIELDS = [
  "accountNumber",
  "currency",
  "amount",
  "foreignAmount",
  "date1",
  "reference",
  "description",
  "textCode",
  "dim1",
  "dim2",
  "dim3",
  "dim4",
  "dim5",
  "dim6",
  "dim7",
  "sign",
] as const;

function toIsoDate(value: string, decimalSep: "." | ","): string {
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  const parts = trimmed.split(/[./-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
  }
  return "";
}

function normalizeAmount(value: string, decimalSep: "." | ","): string {
  let s = String(value).trim().replace(/\s/g, "");
  if (decimalSep === ",") s = s.replace(",", ".");
  s = s.replace(/[^\d.-]/g, "");
  return s || "0";
}

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function parseSignFromAmount(amountStr: string): "+" | "-" {
  const n = parseFloat(amountStr);
  return n < 0 ? "-" : "+";
}

export function parseCsv(
  rawContent: string,
  config: CsvParserConfig
): ParseResult {
  const errors: string[] = [];
  const delimiter = config.delimiter === "\t" ? "\t" : config.delimiter;
  const parseResult = Papa.parse<string[]>(rawContent, {
    delimiter,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length) {
    errors.push(...parseResult.errors.map((e) => e.message ?? String(e)));
  }

  const allRows = parseResult.data as string[][];
  const skipCount = config.dataStartRow ?? 0;
  const rows = skipCount > 0 ? allRows.slice(skipCount) : allRows;
  if (rows.length === 0) {
    return { transactions: [], errors };
  }

  const headerRow = config.hasHeader ? rows[0] : null;
  const dataRows = config.hasHeader ? rows.slice(1) : rows;

  function getCell(row: string[], key: string): string {
    const col = config.columns[key];
    if (col === undefined) return "";
    if (typeof col === "number") {
      return row[col] ?? "";
    }
    if (headerRow) {
      const idx = headerRow.map((h) => (h ?? "").trim().toLowerCase()).indexOf(String(col).toLowerCase());
      if (idx >= 0) return row[idx] ?? "";
    }
    return "";
  }

  const transactions: ParsedTransaction[] = [];
  const skippedRows: RowIssue[] = [];

  const hasCredit = config.columns.credit !== undefined;
  const hasDebit = config.columns.debit !== undefined;
  const useCreditDebit = hasCredit && hasDebit;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.every((c) => !c?.trim())) continue;

    const rowNum = i + (config.hasHeader ? 2 : 1) + (config.dataStartRow ?? 0);

    let amountNorm: string;
    if (useCreditDebit) {
      const creditRaw = normalizeAmount(getCell(row, "credit"), config.decimalSeparator);
      const debitRaw = normalizeAmount(getCell(row, "debit"), config.decimalSeparator);
      const creditVal = parseFloat(creditRaw) || 0;
      const debitVal = parseFloat(debitRaw) || 0;
      const net = creditVal - debitVal;
      amountNorm = Math.abs(net).toFixed(2).replace(/\.?0+$/, "") || "0";
      if (amountNorm === "0") continue;
    } else {
      const amountRaw = getCell(row, "amount").trim();
      amountNorm = normalizeAmount(amountRaw, config.decimalSeparator);
      if (!amountNorm || amountNorm === "0") continue;
    }

    const date1Raw = getCell(row, "date1");
    const date1 = toIsoDate(date1Raw, config.decimalSeparator);
    if (!date1 || !isValidIsoDate(date1)) {
      const displayVal = date1Raw.trim() || "(tom)";
      skippedRows.push({
        rowIndex: i,
        rowNumber: rowNum,
        field: "date1",
        value: displayVal,
        reason: !date1Raw.trim()
          ? "Datofeltet er tomt"
          : `«${displayVal}» er ikke et gjenkjennbart datoformat`,
      });
      errors.push(`Rad ${rowNum}: ugyldig dato «${displayVal}» — raden ble hoppet over`);
      continue;
    }

    const tx: ParsedTransaction = {
      amount: amountNorm,
      date1,
      accountNumber: getCell(row, "accountNumber") || undefined,
      currency: getCell(row, "currency") || undefined,
      foreignAmount: getCell(row, "foreignAmount") || undefined,
      reference: getCell(row, "reference") || undefined,
      description: getCell(row, "description") || undefined,
      textCode: getCell(row, "textCode") || undefined,
      dim1: getCell(row, "dim1") || undefined,
      dim2: getCell(row, "dim2") || undefined,
      dim3: getCell(row, "dim3") || undefined,
      dim4: getCell(row, "dim4") || undefined,
      dim5: getCell(row, "dim5") || undefined,
      dim6: getCell(row, "dim6") || undefined,
      dim7: getCell(row, "dim7") || undefined,
      dim8: getCell(row, "dim8") || undefined,
      dim9: getCell(row, "dim9") || undefined,
      dim10: getCell(row, "dim10") || undefined,
      date2: getCell(row, "date2") || undefined,
      buntref: getCell(row, "buntref") || undefined,
      notat: getCell(row, "notat") || undefined,
      bilag: getCell(row, "bilag") || undefined,
      faktura: getCell(row, "faktura") || undefined,
      forfall: getCell(row, "forfall") || undefined,
      periode: getCell(row, "periode") || undefined,
      importNumber: getCell(row, "importNumber") || undefined,
      avgift: getCell(row, "avgift") || undefined,
      tilleggstekst: getCell(row, "tilleggstekst") || undefined,
      ref2: getCell(row, "ref2") || undefined,
      ref3: getCell(row, "ref3") || undefined,
      ref4: getCell(row, "ref4") || undefined,
      ref5: getCell(row, "ref5") || undefined,
      ref6: getCell(row, "ref6") || undefined,
      anleggsnr: getCell(row, "anleggsnr") || undefined,
      anleggsbeskrivelse: getCell(row, "anleggsbeskrivelse") || undefined,
      bilagsart: getCell(row, "bilagsart") || undefined,
      avsnr: getCell(row, "avsnr") || undefined,
      tid: getCell(row, "tid") || undefined,
      avvikendeDato: getCell(row, "avvikendeDato") || undefined,
      rate: getCell(row, "rate") || undefined,
      kundenavn: getCell(row, "kundenavn") || undefined,
      kontonummerBokføring: getCell(row, "kontonummerBokføring") || undefined,
    };

    if (useCreditDebit) {
      const creditVal = parseFloat(normalizeAmount(getCell(row, "credit"), config.decimalSeparator)) || 0;
      const debitVal = parseFloat(normalizeAmount(getCell(row, "debit"), config.decimalSeparator)) || 0;
      tx.sign = creditVal >= debitVal ? "+" : "-";
    } else {
      const signCol = getCell(row, "sign").trim();
      if (signCol === "+" || signCol === "-") {
        tx.sign = signCol;
      } else if (config.signFromAmount !== false) {
        tx.sign = parseSignFromAmount(amountNorm);
      }
    }

    transactions.push(tx);
  }

  return { transactions, errors, skippedRows };
}
