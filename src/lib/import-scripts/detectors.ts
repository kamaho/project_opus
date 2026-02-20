/**
 * Auto-deteksjon av skilletegn, datoformat, datatype og felt fra CSV/tekst.
 * Portet fra script_builder med tilpasning til våre interne feltnavn.
 */

import type { DataType, InternalFieldKey, SeparatorChar } from "./types";

const DATE_PATTERNS: { regex: RegExp; format: string }[] = [
  { regex: /^\d{2}\.\d{2}\.\d{4}$/, format: "DD.MM.YYYY" },
  { regex: /^\d{2}\/\d{2}\/\d{4}$/, format: "DD/MM/YYYY" },
  { regex: /^\d{4}-\d{2}-\d{2}(T.*)?$/, format: "YYYY-MM-DD" },
  { regex: /^\d{8}$/, format: "YYYYMMDD" },
  { regex: /^\d{2}-\d{2}-\d{4}$/, format: "DD-MM-YYYY" },
  { regex: /^\d{2}\/\d{2}\/\d{2}$/, format: "DD/MM/YY" },
];

export function detectDateFormat(
  samples: string[]
): { isDate: boolean; format: string } {
  const nonEmpty = samples.filter(
    (s) => s != null && String(s).trim() !== ""
  );
  if (nonEmpty.length === 0) return { isDate: false, format: "" };

  for (const { regex, format } of DATE_PATTERNS) {
    if (nonEmpty.every((s) => regex.test(String(s).trim()))) {
      return { isDate: true, format };
    }
  }
  return { isDate: false, format: "" };
}

export function detectDataType(
  samples: string[],
  isExcelDate = false
): DataType {
  if (isExcelDate) return "date";

  const nonEmpty = samples.filter(
    (s) => s != null && String(s).trim() !== ""
  );
  if (nonEmpty.length === 0) return "text";

  const { isDate } = detectDateFormat(nonEmpty);
  if (isDate) return "date";

  if (
    nonEmpty.every((s) => {
      const n = String(s).replace(",", ".").replace(/\s/g, "");
      return n !== "" && !Number.isNaN(parseFloat(n)) && Number.isFinite(Number(n));
    })
  ) {
    return "number";
  }

  return "text";
}

export function detectSeparator(firstLine: string): SeparatorChar {
  const counts: Record<string, number> = {
    ";": (firstLine.match(/;/g) || []).length,
    ",": (firstLine.match(/,/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
    "|": (firstLine.match(/\|/g) || []).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (best[1] > 0 ? best[0] : ";") as SeparatorChar;
}

export function detectTextQualifier(
  text: string
): { has: boolean; char: string } {
  const sample = text.split("\n").slice(0, 10).join("\n");
  const dq = (sample.match(/"/g) || []).length;
  const sq = (sample.match(/'/g) || []).length;
  if (dq > 1) return { has: true, char: '"' };
  if (sq > 1) return { has: true, char: "'" };
  return { has: false, char: "" };
}

/**
 * Forslår internt felt (date1, amount, reference, description, osv.) ut fra kolonneheader.
 * Brukes for auto-mapping ved CSV-import.
 */
export function guessField(header: string): InternalFieldKey | "" {
  const h = header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9æøå]/g, "");

  const mappings: Array<{
    exact?: string[];
    contains?: string[];
    field: InternalFieldKey;
  }> = [
    {
      exact: [
        "dato",
        "date",
        "bilagsdato",
        "transdate",
        "regnskapsdato",
        "bokfdato",
        "postdate",
        "transaksjonsdato",
        "bokforingsdato",
      ],
      contains: ["dato", "date"],
      field: "date1",
    },
    {
      exact: [
        "belopivaluta",
        "beløpivaluta",
        "amountincurrency",
        "valutabelop",
        "valutabeløp",
        "valutabelp",
      ],
      contains: ["valutabeløp", "valutabelop", "amountincurrency"],
      field: "foreignAmount",
    },
    {
      exact: [
        "belop",
        "betalingsbelop",
        "amount",
        "sum",
        "debit",
        "credit",
        "nok",
        "beløp",
        "bokfrtbelp",
        "bokførtbeløp",
      ],
      contains: ["belop", "beløp", "bokført", "bokfrt", "amount", "sum"],
      field: "amount",
    },
    {
      exact: ["ref", "referanse", "reference", "bilagsnr", "voucher"],
      contains: ["ref", "referanse", "reference"],
      field: "reference",
    },
    {
      exact: [
        "tekst",
        "beskrivelse",
        "description",
        "melding",
        "text",
        "opplysninger",
      ],
      contains: ["tekst", "beskrivelse", "description"],
      field: "description",
    },
    {
      exact: ["kontonr", "kontonummer", "account", "accountnumber"],
      contains: ["kontonr", "kontonummer", "account"],
      field: "accountNumber",
    },
    {
      exact: ["valutakode", "currency", "valuta"],
      field: "currency",
    },
  ];

  for (const m of mappings) {
    if (m.exact?.some((x) => h === x || h.includes(x))) return m.field;
  }
  for (const m of mappings) {
    if (m.contains?.some((p) => h.includes(p))) return m.field;
  }

  return "";
}
