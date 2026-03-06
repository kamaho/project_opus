/**
 * Client-side parser for the Account Control onboarding Excel template.
 *
 * Expected structure (sheet "kontoer"):
 *   Row 8 (index 7): Header row — column E contains IB date in text
 *   Row 9-11: Example rows (marker "Eksempel" in column A)
 *   Row 13+: Data rows (marker "Fyll inn->" in column A)
 *
 * Columns (0-indexed):
 *   A(0): Marker, B(1): Konsernnavn, C(2): Selskapsnavn,
 *   D(3): Kontonr regnskap, E(4): IB regnskap, F(5): Åpningsposter regnskap,
 *   G(6): Filformat regnskap, H(7): Bankkontonr (BBAN/IBAN),
 *   I(8): IB bank, J(9): Åpningsposter bank, K(10): Banknavn,
 *   L(11): Filformat bank
 */

import * as XLSX from "xlsx";
import { normalizeToIBAN, type IBANResult } from "./iban";

const COL = {
  marker: 0,
  konsernnavn: 1,
  selskapsnavn: 2,
  kontonrRegnskap: 3,
  ibRegnskap: 4,
  apRegnskap: 5,
  bankkontonr: 7,
  ibBank: 8,
  apBank: 9,
  banknavn: 10,
} as const;

export interface OnboardingRow {
  index: number;
  konsernnavn: string;
  selskapsnavn: string;
  kontonrRegnskap: string;
  ibRegnskap: number | null;
  apRegnskap: boolean;
  bankkontonr: string;
  ibanResult: IBANResult;
  ibBank: number | null;
  apBank: boolean;
  banknavn: string;
  valid: boolean;
  errors: string[];
}

export interface ParseResult {
  rows: OnboardingRow[];
  ibDate: string;
  fileName: string;
  sheetName: string;
}

function parseNumeric(val: unknown): number | null {
  if (val == null || String(val).trim() === "") return null;
  if (typeof val === "number" && isFinite(val)) return val;
  const s = String(val).trim().replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function parseJaNei(val: unknown): boolean {
  const s = String(val ?? "").toLowerCase();
  if (s.includes("nei") || s === "" || s === "0") return false;
  return s.length > 0;
}

function extractDateFromHeader(headerText: string): string {
  const match = headerText.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

export function parseOnboardingExcel(buffer: ArrayBuffer, fileName: string): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });

  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes("konto")) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  });

  if (allRows.length < 9) {
    throw new Error("Filen har for få rader — forventet minst 9 (header på rad 8).");
  }

  const headerRow = allRows[7] as string[];
  const ibDateHeader = String(headerRow?.[COL.ibRegnskap] ?? "");
  const ibDate = extractDateFromHeader(ibDateHeader);

  const dataRows = allRows.slice(8).filter((row) => {
    const r = row as unknown[];
    const marker = String(r[COL.marker] ?? "").toLowerCase();
    const selskap = String(r[COL.selskapsnavn] ?? "").trim();
    return selskap !== "" && !marker.includes("eksempel");
  });

  if (dataRows.length === 0) {
    throw new Error(
      "Ingen datarader funnet. Sjekk at filen har rader merket \"Fyll inn->\" i kolonne A."
    );
  }

  const rows: OnboardingRow[] = dataRows.map((raw, i) => {
    const r = raw as unknown[];
    const errors: string[] = [];

    const selskapsnavn = String(r[COL.selskapsnavn] ?? "").trim();
    const kontonrRegnskap = String(r[COL.kontonrRegnskap] ?? "").trim();
    const bankRaw = String(r[COL.bankkontonr] ?? "").trim();
    const banknavnFromFile = String(r[COL.banknavn] ?? "").trim();

    if (!selskapsnavn) errors.push("Mangler selskapsnavn");
    if (!kontonrRegnskap) errors.push("Mangler kontonr regnskap");

    const ibanResult = bankRaw ? normalizeToIBAN(bankRaw) : {
      ok: false, iban: "", bbanDigits: "", bbanFormatted: "", bank: "", error: "Mangler bankkontonr",
    };
    if (!ibanResult.ok) errors.push(ibanResult.error ?? "Ugyldig bankkontonr");

    const banknavn = banknavnFromFile || ibanResult.bank || "";

    return {
      index: i,
      konsernnavn: String(r[COL.konsernnavn] ?? "").trim(),
      selskapsnavn,
      kontonrRegnskap,
      ibRegnskap: parseNumeric(r[COL.ibRegnskap]),
      apRegnskap: parseJaNei(r[COL.apRegnskap]),
      bankkontonr: bankRaw,
      ibanResult,
      ibBank: parseNumeric(r[COL.ibBank]),
      apBank: parseJaNei(r[COL.apBank]),
      banknavn,
      valid: errors.length === 0,
      errors,
    };
  });

  return { rows, ibDate, fileName, sheetName };
}
