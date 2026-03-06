/**
 * Shared utilities for batch IBAN conversion from Excel/CSV data.
 * Column detection, CSV parsing, and export helpers.
 */

import { normalizeToIBAN, normalizeBBAN, validateMod11, type IBANResult } from "./iban";

export interface BatchRow {
  index: number;
  original: string;
  digits: string;
  ibanResult: IBANResult;
  saldo: string | null;
  dato: string | null;
}

/** Score each column to find the one most likely to contain BBANs. */
export function finnBestKolonne(rows: unknown[][], numCols: number): number {
  const scores = Array(numCols).fill(0) as number[];
  for (const row of rows) {
    for (let c = 0; c < numCols; c++) {
      const d = normalizeBBAN(row[c]);
      if (d.length === 11 && validateMod11(d)) scores[c]++;
    }
  }
  let best = 0;
  for (let c = 1; c < numCols; c++) {
    if (scores[c] > scores[best]) best = c;
  }
  return best;
}

export function erBelop(val: unknown): boolean {
  if (val == null || String(val).trim() === "") return false;
  if (typeof val === "number" && isFinite(val)) return true;
  const s = String(val).trim();
  if (/^-?[\d\s.]+,\d{1,4}$/.test(s)) return true;
  if (/^-?[\d\s,]+\.?\d*$/.test(s) && /\d/.test(s)) return true;
  return false;
}

export function erDato(val: unknown): boolean {
  if (val == null || String(val).trim() === "") return false;
  if (typeof val === "number" && val > 25000 && val < 60000) return true;
  const s = String(val).trim();
  if (/^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}$/.test(s)) return true;
  if (/^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(s)) return true;
  return false;
}

export function formaterDato(val: unknown): string {
  if (val == null || String(val).trim() === "") return "";
  if (typeof val === "number" && val > 25000 && val < 60000) {
    const ms = (val - 25569) * 86400000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return String(val).trim();
}

export function formaterBelop(val: unknown): string {
  if (val == null || String(val).trim() === "") return "";
  if (typeof val === "number") {
    return val.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(val).trim();
}

export interface EkstraKolonner {
  saldoKolIdx: number | null;
  datoKolIdx: number | null;
}

export function finnEkstraKolonner(rows: unknown[][], numCols: number, bbanKolIdx: number): EkstraKolonner {
  const saldoScores = Array(numCols).fill(0) as number[];
  const datoScores = Array(numCols).fill(0) as number[];

  for (const row of rows) {
    for (let c = 0; c < numCols; c++) {
      if (c === bbanKolIdx) continue;
      if (erBelop(row[c])) saldoScores[c]++;
      if (erDato(row[c])) datoScores[c]++;
    }
  }

  const terskel = Math.max(2, Math.floor(rows.length * 0.3));
  const saldoKol = saldoScores.reduce((best, s, i) => (s > saldoScores[best] ? i : best), 0);
  const datoKol = datoScores.reduce((best, s, i) => (s > datoScores[best] ? i : best), 0);

  return {
    saldoKolIdx: saldoScores[saldoKol] >= terskel ? saldoKol : null,
    datoKolIdx: datoScores[datoKol] >= terskel ? datoKol : null,
  };
}

export function detekterSep(linje: string): string {
  const tabs = (linje.match(/\t/g) || []).length;
  const semikolon = (linje.match(/;/g) || []).length;
  const komma = (linje.match(/,/g) || []).length;
  if (tabs >= semikolon && tabs >= komma) return "\t";
  if (semikolon >= komma) return ";";
  return ",";
}

export function splittLinje(linje: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < linje.length; i++) {
    const ch = linje[i];
    if (ch === '"') {
      if (inQ && linje[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === sep && !inQ) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Convert batch rows from generic Excel/CSV data. */
export function konverterBatch(
  rows: unknown[][],
  bbanKolIdx: number,
  ekstra: EkstraKolonner
): BatchRow[] {
  return rows
    .filter((row) => normalizeBBAN(row[bbanKolIdx]).length > 0)
    .map((row, i) => {
      const raw = normalizeBBAN(row[bbanKolIdx]);
      const ibanResult = normalizeToIBAN(raw);
      return {
        index: i,
        original: String(row[bbanKolIdx] ?? ""),
        digits: raw,
        ibanResult,
        saldo: ekstra.saldoKolIdx !== null ? String(row[ekstra.saldoKolIdx] ?? "") : null,
        dato: ekstra.datoKolIdx !== null ? String(row[ekstra.datoKolIdx] ?? "") : null,
      };
    });
}

/** Build TSV string from header + row data for clipboard. */
export function byggTsv(headers: string[], rows: string[][]): string {
  return [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
}

/** Build CSV string with BOM for download. */
export function byggCsv(headers: string[], rows: string[][]): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}

/** Download a string as a file. */
export function lastNedFil(content: string, filename: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copy text to clipboard with fallback. */
export async function kopierTilUtklipp(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
