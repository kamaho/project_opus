/**
 * Norwegian BBAN/IBAN utilities.
 * Ported from internal onboarding tool — Mod 11 validation, Mod 97 IBAN
 * calculation, and bank name recognition from 4-digit prefix.
 */

const BANKS: { prefix: [number, number][]; name: string }[] = [
  { prefix: [[1200,1299],[1500,1699],[1750,1799],[7694,7699],[8000,8099],[8200,8299],[8400,8499],[8601,8699]], name: "DNB Bank" },
  { prefix: [[6000,6199],[6300,6399],[9000,9049]], name: "Nordea" },
  { prefix: [[3000,3299],[3600,3699]], name: "SpareBank 1 SR-Bank" },
  { prefix: [[4200,4399],[4700,4799]], name: "SpareBank 1 SMN" },
  { prefix: [[4500,4699],[4800,4899]], name: "SpareBank 1 Nord-Norge" },
  { prefix: [[2100,2399]], name: "SpareBank 1 Østlandet" },
  { prefix: [[2600,2699]], name: "SpareBank 1 BV" },
  { prefix: [[2700,2799]], name: "SpareBank 1 Hallingdal Valdres" },
  { prefix: [[2800,2899]], name: "SpareBank 1 Ringerike Hadeland" },
  { prefix: [[2930,2939]], name: "SpareBank 1 Lom og Skjåk" },
  { prefix: [[2940,2959]], name: "SpareBank 1 Gudbrandsdal" },
  { prefix: [[3700,3749]], name: "SpareBank 1 Søre Sunnmøre" },
  { prefix: [[3800,3999]], name: "Sparebanken Vest" },
  { prefix: [[3300,3499],[3500,3599]], name: "Sparebanken Sør" },
  { prefix: [[2900,2929],[2960,2999]], name: "Sparebanken Møre" },
  { prefix: [[1700,1749]], name: "Sparebanken Telemark" },
  { prefix: [[9350,9399]], name: "Handelsbanken" },
  { prefix: [[9070,9099]], name: "Danske Bank" },
  { prefix: [[9560,9599]], name: "Swedbank" },
  { prefix: [[9710,9729]], name: "Sbanken" },
  { prefix: [[9530,9549]], name: "Santander Consumer Bank" },
  { prefix: [[9630,9639]], name: "Komplett Bank" },
  { prefix: [[9640,9649]], name: "Bank Norwegian" },
  { prefix: [[1300,1399]], name: "Landkreditt Bank" },
  { prefix: [[1220,1229]], name: "Cultura Bank" },
  { prefix: [[9980,9989]], name: "Storebrand Bank" },
  { prefix: [[7850,7899]], name: "Gjensidige Bank" },
  { prefix: [[9260,9269]], name: "Fana Sparebank" },
  { prefix: [[9650,9659]], name: "Klarna Bank" },
  { prefix: [[6200,6249]], name: "BN Bank" },
  { prefix: [[2400,2449]], name: "Totens Sparebank" },
  { prefix: [[1400,1499]], name: "SpareBank 1 Østfold Akershus" },
  { prefix: [[4900,4999]], name: "Lokale sparebanker (Trøndelag)" },
  { prefix: [[5000,5099]], name: "Lokale sparebanker" },
];

export function recognizeBank(digits: string): string {
  if (digits.length < 4) return "";
  const prefix = parseInt(digits.substring(0, 4), 10);
  for (const b of BANKS) {
    for (const [lo, hi] of b.prefix) {
      if (prefix >= lo && prefix <= hi) return b.name;
    }
  }
  return "";
}

export function validateMod11(digits: string): boolean {
  if (digits.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * weights[i];
  const rest = sum % 11;
  if (rest === 0) return parseInt(digits[10], 10) === 0;
  const check = 11 - rest;
  if (check === 10) return false;
  return parseInt(digits[10], 10) === check;
}

export function calculateIBAN(bban: string): string {
  const numStr = bban + "232400";
  let rem = BigInt(0);
  const TEN = BigInt(10);
  const MOD = BigInt(97);
  for (const ch of numStr) rem = (rem * TEN + BigInt(parseInt(ch, 10))) % MOD;
  const checkDigits = (BigInt(98) - rem).toString().padStart(2, "0");
  return "NO" + checkDigits + bban;
}

export function formatIBAN(iban: string): string {
  return iban.match(/.{1,4}/g)?.join(" ") ?? iban;
}

export function formatBBAN(digits: string): string {
  if (digits.length !== 11) return digits;
  return digits.substring(0, 4) + "." + digits.substring(4, 6) + "." + digits.substring(6);
}

/** Strip all non-digits from a value, handle Excel number artifacts like ".0" */
export function normalizeBBAN(val: unknown): string {
  if (val == null) return "";
  let s = String(val).trim();
  s = s.replace(/\.0+$/, "");
  return s.replace(/\D/g, "");
}

export interface IBANResult {
  ok: boolean;
  iban: string;
  bbanDigits: string;
  bbanFormatted: string;
  bank: string;
  error?: string;
}

/** Check if a value is already IBAN format (NOxx...) */
export function isIBAN(val: string): boolean {
  return /^NO\d{13}$/.test(val.replace(/\s/g, ""));
}

/** Extract BBAN digits from an IBAN string */
export function ibanToBBAN(iban: string): string {
  return iban.replace(/\s/g, "").substring(4);
}

/**
 * Normalize a bank account number to IBAN.
 * Accepts both BBAN (11 digits) and IBAN (NO + 13 digits).
 */
export function normalizeToIBAN(raw: string): IBANResult {
  const cleaned = raw.replace(/\s/g, "");

  if (isIBAN(cleaned)) {
    const bban = ibanToBBAN(cleaned);
    return {
      ok: true,
      iban: cleaned,
      bbanDigits: bban,
      bbanFormatted: formatBBAN(bban),
      bank: recognizeBank(bban),
    };
  }

  const digits = normalizeBBAN(raw);
  if (digits.length === 0) return { ok: false, iban: "", bbanDigits: "", bbanFormatted: "", bank: "", error: "Tomt kontonummer" };
  if (digits.length !== 11) return { ok: false, iban: "", bbanDigits: digits, bbanFormatted: digits, bank: "", error: `Feil lengde (${digits.length}, forventet 11)` };
  if (!validateMod11(digits)) return { ok: false, iban: "", bbanDigits: digits, bbanFormatted: formatBBAN(digits), bank: "", error: "Ugyldig kontonummer (Mod 11)" };

  const iban = calculateIBAN(digits);
  return {
    ok: true,
    iban,
    bbanDigits: digits,
    bbanFormatted: formatBBAN(digits),
    bank: recognizeBank(digits),
  };
}
