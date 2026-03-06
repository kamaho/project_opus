/**
 * Peek at file content to detect an account number without full parsing.
 *
 * Strategies by file type:
 * - CAMT/XML: extract from Stmt/Acct/Id (IBAN or BBAN)
 * - CSV/Excel: 1) header-based column detection  2) regex scan of first N data lines
 * - Klink (fixed-width): extract from known field positions
 * - Filename fallback: regex on the file name
 */

import { validateMod11, isIBAN, ibanToBBAN } from "@/lib/onboarding/iban";

export interface PeekResult {
  accountNumber: string | null;
  source: "camt_stmt" | "header_col" | "data_scan" | "filename" | "klink" | null;
}

const ACCOUNT_HEADER_NAMES = [
  "kontonr", "kontonummer", "konto", "account", "accountnumber",
  "account_number", "account number", "acct", "bankaccount",
  "bankkonto", "fra konto", "til konto",
];

const NORWEGIAN_ACCOUNT_RE = /\b(\d{11})\b/g;
const IBAN_NO_RE = /\bNO\d{13}\b/gi;

/**
 * Peek at file content to extract an account number.
 */
export function peekAccountNumber(
  content: string,
  fileType: "csv" | "camt" | "klink" | "excel",
  fileName?: string,
  rawRows?: string[][],
): PeekResult {
  if (fileType === "camt") return peekCamt(content);
  if (fileType === "klink") return peekKlink(content);
  if (fileType === "csv" || fileType === "excel") {
    const rows = rawRows ?? (fileType === "csv" ? splitCsvRows(content) : []);
    const fromHeader = peekFromHeader(rows);
    if (fromHeader.accountNumber) return fromHeader;
    const fromData = peekFromDataScan(rows);
    if (fromData.accountNumber) return fromData;
  }
  if (fileName) {
    const fromName = peekFromFilename(fileName);
    if (fromName.accountNumber) return fromName;
  }
  return { accountNumber: null, source: null };
}

function peekCamt(xml: string): PeekResult {
  const ibanMatch = xml.match(/<IBAN>\s*(NO\d{13})\s*<\/IBAN>/i);
  if (ibanMatch) {
    return { accountNumber: ibanMatch[1], source: "camt_stmt" };
  }
  const othrMatch = xml.match(/<Othr>\s*<Id>\s*(\d{11})\s*<\/Id>/i);
  if (othrMatch && validateMod11(othrMatch[1])) {
    return { accountNumber: othrMatch[1], source: "camt_stmt" };
  }
  const genericIban = xml.match(IBAN_NO_RE);
  if (genericIban) {
    return { accountNumber: genericIban[0].replace(/\s/g, ""), source: "camt_stmt" };
  }
  return { accountNumber: null, source: null };
}

function peekKlink(content: string): PeekResult {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines.slice(0, 20)) {
    const digits = line.replace(/\D/g, "");
    if (digits.length >= 11) {
      for (let i = 0; i <= digits.length - 11; i++) {
        const candidate = digits.substring(i, i + 11);
        if (validateMod11(candidate)) {
          return { accountNumber: candidate, source: "klink" };
        }
      }
    }
  }
  return { accountNumber: null, source: null };
}

function peekFromHeader(rows: string[][]): PeekResult {
  if (rows.length < 2) return { accountNumber: null, source: null };
  const headerRow = rows[0];
  const accountColIndex = headerRow.findIndex((h) =>
    ACCOUNT_HEADER_NAMES.includes(h.toLowerCase().trim())
  );
  if (accountColIndex < 0) return { accountNumber: null, source: null };

  for (let i = 1; i < Math.min(rows.length, 6); i++) {
    const val = (rows[i][accountColIndex] ?? "").trim();
    if (!val) continue;

    if (isIBAN(val.replace(/\s/g, ""))) {
      return { accountNumber: val.replace(/\s/g, ""), source: "header_col" };
    }
    const digits = val.replace(/\D/g, "");
    if (digits.length === 11 && validateMod11(digits)) {
      return { accountNumber: digits, source: "header_col" };
    }
  }
  return { accountNumber: null, source: null };
}

function peekFromDataScan(rows: string[][]): PeekResult {
  const linesToScan = rows.slice(0, 6);
  for (const row of linesToScan) {
    const line = row.join(" ");

    const ibanMatches = line.match(IBAN_NO_RE);
    if (ibanMatches) {
      const iban = ibanMatches[0].replace(/\s/g, "");
      const bban = ibanToBBAN(iban);
      if (validateMod11(bban)) {
        return { accountNumber: iban, source: "data_scan" };
      }
    }

    let match: RegExpExecArray | null;
    NORWEGIAN_ACCOUNT_RE.lastIndex = 0;
    while ((match = NORWEGIAN_ACCOUNT_RE.exec(line)) !== null) {
      if (validateMod11(match[1])) {
        return { accountNumber: match[1], source: "data_scan" };
      }
    }
  }
  return { accountNumber: null, source: null };
}

function peekFromFilename(name: string): PeekResult {
  const ibanMatch = name.match(IBAN_NO_RE);
  if (ibanMatch) {
    const iban = ibanMatch[0].replace(/\s/g, "");
    const bban = ibanToBBAN(iban);
    if (validateMod11(bban)) {
      return { accountNumber: iban, source: "filename" };
    }
  }

  NORWEGIAN_ACCOUNT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NORWEGIAN_ACCOUNT_RE.exec(name)) !== null) {
    if (validateMod11(match[1])) {
      return { accountNumber: match[1], source: "filename" };
    }
  }
  return { accountNumber: null, source: null };
}

function splitCsvRows(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const firstLine = lines[0] ?? "";
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of firstLine) {
    if (ch in counts) counts[ch]++;
  }
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";";
  return lines.map((l) => l.split(delim));
}
