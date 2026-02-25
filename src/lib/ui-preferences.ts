/**
 * UI preferences: extensible model for user-customizable appearance.
 * Persisted in localStorage; can later be synced from backend (e.g. whitelabel).
 */

export type TextSizePreference = "normal" | "large" | "larger";
export type TextWeightPreference = "normal" | "medium" | "bold";

/** nb = 1 234 567,89 · en = 1,234,567.89 · ch = 1'234'567.89 */
export type NumberFormatPreference = "nb" | "en" | "ch";

/** nb = dd.MM.yyyy · iso = yyyy-MM-dd · us = MM/dd/yyyy */
export type DateFormatPreference = "nb" | "iso" | "us";

/** UI language: Norwegian (bokmål) or English */
export type LocalePreference = "nb" | "en";

export interface UiPreferences {
  /** UI language for labels, messages, etc. */
  locale: LocalePreference;
  table: {
    /** Tydelige skillelinjer mellom rader og kolonner. Default true. */
    visibleDividers: boolean;
  };
  typography: {
    /** Basis tekststørrelse for bedre lesbarhet (svaksynte). */
    textSize: TextSizePreference;
    /** Fetthet på brødtekst. */
    textWeight: TextWeightPreference;
  };
  formatting: {
    /** Tallformat – norsk som standard. */
    numberFormat: NumberFormatPreference;
    /** Datoformat – norsk som standard. */
    dateFormat: DateFormatPreference;
  };
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  locale: "nb",
  table: {
    visibleDividers: true,
  },
  typography: {
    textSize: "normal",
    textWeight: "normal",
  },
  formatting: {
    numberFormat: "nb",
    dateFormat: "nb",
  },
};

export const UI_PREFERENCES_STORAGE_KEY = "project_opus_ui_preferences";

function isClient(): boolean {
  return typeof window !== "undefined";
}

export function loadUiPreferences(): UiPreferences {
  if (!isClient()) return DEFAULT_UI_PREFERENCES;
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return DEFAULT_UI_PREFERENCES;
    const rawLocale =
      typeof (parsed as { locale?: unknown }).locale === "string"
        ? String((parsed as { locale: string }).locale)
        : "";
    const validLocale: LocalePreference =
      rawLocale === "en" ? "en" : "nb";
    const table = (parsed as { table?: unknown }).table;
    const visibleDividers =
      typeof table === "object" && table !== null && "visibleDividers" in table
        ? Boolean((table as { visibleDividers?: unknown }).visibleDividers)
        : DEFAULT_UI_PREFERENCES.table.visibleDividers;

    const typo = (parsed as { typography?: unknown }).typography;
    const textSize =
      typeof typo === "object" && typo !== null && "textSize" in typo
        ? String((typo as { textSize?: unknown }).textSize)
        : DEFAULT_UI_PREFERENCES.typography.textSize;
    const textWeight =
      typeof typo === "object" && typo !== null && "textWeight" in typo
        ? String((typo as { textWeight?: unknown }).textWeight)
        : DEFAULT_UI_PREFERENCES.typography.textWeight;

    const validSize: TextSizePreference =
      textSize === "large" || textSize === "larger" ? textSize : "normal";
    const validWeight: TextWeightPreference =
      textWeight === "medium" || textWeight === "bold" ? textWeight : "normal";

    const fmt = (parsed as { formatting?: unknown }).formatting;
    const rawNumberFormat =
      typeof fmt === "object" && fmt !== null && "numberFormat" in fmt
        ? String((fmt as { numberFormat?: unknown }).numberFormat)
        : DEFAULT_UI_PREFERENCES.formatting.numberFormat;
    const rawDateFormat =
      typeof fmt === "object" && fmt !== null && "dateFormat" in fmt
        ? String((fmt as { dateFormat?: unknown }).dateFormat)
        : DEFAULT_UI_PREFERENCES.formatting.dateFormat;

    const validNumberFormat: NumberFormatPreference =
      rawNumberFormat === "en" || rawNumberFormat === "ch" ? rawNumberFormat : "nb";
    const validDateFormat: DateFormatPreference =
      rawDateFormat === "iso" || rawDateFormat === "us" ? rawDateFormat : "nb";

    return {
      locale: validLocale,
      table: { visibleDividers },
      typography: { textSize: validSize, textWeight: validWeight },
      formatting: { numberFormat: validNumberFormat, dateFormat: validDateFormat },
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

export function saveUiPreferences(prefs: UiPreferences): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota / security errors
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers – pure functions that accept preference values
// ---------------------------------------------------------------------------

const NUMBER_LOCALE: Record<NumberFormatPreference, string> = {
  nb: "nb-NO",
  en: "en-US",
  ch: "de-CH",
};

/**
 * Format a number according to the given preference.
 * Always uses 2 fraction digits (financial amounts).
 */
export function formatNumber(
  n: number,
  pref: NumberFormatPreference = "nb",
): string {
  return n.toLocaleString(NUMBER_LOCALE[pref], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format absolute value – useful for amounts where sign is rendered separately.
 */
export function formatAbsNumber(
  n: number,
  pref: NumberFormatPreference = "nb",
): string {
  return Math.abs(n).toLocaleString(NUMBER_LOCALE[pref], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Live input formatting — formats while user is still typing
// ---------------------------------------------------------------------------

const THOUSAND_SEP: Record<NumberFormatPreference, string> = {
  nb: "\u00a0",  // non-breaking space
  en: ",",
  ch: "\u2019",  // right single quotation mark (Swiss standard)
};

const DECIMAL_SEP: Record<NumberFormatPreference, string> = {
  nb: ",",
  en: ".",
  ch: ".",
};

/**
 * Insert thousand separators into the integer part of a digit string.
 */
function addThousandSep(digits: string, sep: string): string {
  const len = digits.length;
  if (len <= 3) return digits;
  let result = "";
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) result += sep;
    result += digits[i];
  }
  return result;
}

/**
 * Format an amount string while the user is typing.
 * Returns { display, rawDigits } where display includes thousand separators
 * and the locale-correct decimal separator, while rawDigits is the
 * canonical "123456.78" form for data binding.
 */
export function formatAmountLive(
  input: string,
  pref: NumberFormatPreference = "nb",
): { display: string; raw: string } {
  const tSep = THOUSAND_SEP[pref];
  const dSep = DECIMAL_SEP[pref];

  // Strip everything except digits, minus, dot, and comma
  let cleaned = input.replace(/[^\d.,-]/g, "");

  // Preserve leading minus
  const negative = cleaned.startsWith("-");
  cleaned = cleaned.replace(/-/g, "");

  // Normalise decimal separator: treat both , and . as decimal point
  // If both are present, last one wins as decimal separator
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let intPart: string;
  let decPart: string | null = null;

  if (lastComma === -1 && lastDot === -1) {
    intPart = cleaned;
  } else {
    const decPos = Math.max(lastComma, lastDot);
    intPart = cleaned.slice(0, decPos).replace(/[.,]/g, "");
    decPart = cleaned.slice(decPos + 1).replace(/[.,]/g, "");
  }

  // Remove leading zeros (but keep "0" alone)
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";

  const formattedInt = addThousandSep(intPart, tSep);
  const sign = negative ? "-" : "";
  const display =
    decPart !== null
      ? `${sign}${formattedInt}${dSep}${decPart}`
      : `${sign}${formattedInt}`;

  const raw =
    decPart !== null
      ? `${sign}${intPart}.${decPart}`
      : `${sign}${intPart}`;

  return { display, raw };
}

/**
 * Count how many "significant" characters (digits + minus + decimal point)
 * appear up to a given index in a formatted string.
 */
export function countSignificantChars(str: string, upTo: number): number {
  let count = 0;
  for (let i = 0; i < upTo && i < str.length; i++) {
    const ch = str[i];
    if ((ch >= "0" && ch <= "9") || ch === "-" || ch === "." || ch === ",") {
      count++;
    }
  }
  return count;
}

/**
 * Find the index in `formatted` where `targetCount` significant characters
 * have been seen. Used to restore cursor position after reformatting.
 */
export function findCursorPosition(formatted: string, targetCount: number): number {
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if ((ch >= "0" && ch <= "9") || ch === "-" || ch === "." || ch === ",") {
      count++;
    }
    if (count >= targetCount) return i + 1;
  }
  return formatted.length;
}

/**
 * Format a date string (yyyy-MM-dd or ISO timestamp) according to preference.
 * If `value` is already a Date, pass it directly.
 */
export function formatDate(
  value: string | Date,
  pref: DateFormatPreference = "nb",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  switch (pref) {
    case "nb":
      return `${day}.${month}.${year}`;
    case "iso":
      return `${year}-${month}-${day}`;
    case "us":
      return `${month}/${day}/${year}`;
  }
}

/**
 * Format a date with time for display (e.g. match timestamps).
 */
export function formatDateTime(
  value: string | Date,
  pref: DateFormatPreference = "nb",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const datePart = formatDate(d, pref);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} ${h}:${m}`;
}
