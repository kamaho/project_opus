/**
 * Generering av import-script for tegne-separerte filer (CSV).
 * Format beskrevet i docs/import-scripts/01-tegnseparert-script-format.md
 */

import type { CsvParserConfig } from "@/lib/parsers";
import type { ColumnMapping, InternalFieldKey, ParsedFileMeta } from "./types";
import { FIELD_ORDER, SCRIPT_FIELD_LABELS } from "./types";

function getIdPattern(dateFormat: string): string {
  switch (dateFormat) {
    case "DD.MM.YYYY":
      return "??.??.????";
    case "DD/MM/YYYY":
      return "??/??/????";
    case "DD-MM-YYYY":
      return "??-??-????";
    case "YYYY-MM-DD":
      return "????-??-??";
    case "YYYYMMDD":
      return "????????";
    default:
      return "??.??.????";
  }
}

export interface ScriptGenerateOptions {
  /** Kolonner med valgt felt (suggestedField eller brukervalg) */
  columns: ColumnMapping[];
  separator: string;
  textQualifier: string;
  /** Felt som skal brukes for BARENYE (duplikatsjekk), f.eks. ['date1', 'amount'] */
  bareNyeFields?: InternalFieldKey[];
}

/**
 * Genererer script-tekst for tegne-separert fil.
 * Kolonneindeks i output er 1-basert (som i script-formatet).
 */
export function generateCsvScript(opts: ScriptGenerateOptions): string {
  const {
    columns,
    separator,
    textQualifier,
    bareNyeFields = ["date1", "amount"],
  } = opts;

  const lines: string[] = [];

  lines.push("FILTYPE;TEGNSEPARERT");

  for (const field of bareNyeFields) {
    const label = SCRIPT_FIELD_LABELS[field] ?? field;
    lines.push(`BARENYE;${label};`);
  }

  if (separator === "\t") {
    lines.push("SEPARATORTEGN;CHR(9)");
  } else {
    lines.push(`SEPARATORTEGN;${separator};`);
  }
  if (textQualifier) {
    lines.push(`TEKSTKVALIFIKATOR;${textQualifier}`);
  }

  lines.push("[TRANSER]");

  const mapped = columns
    .filter((c) => c.suggestedField !== "" && c.suggestedField !== "none")
    .sort((a, b) => {
      const ai = FIELD_ORDER.indexOf(a.suggestedField as InternalFieldKey);
      const bi = FIELD_ORDER.indexOf(b.suggestedField as InternalFieldKey);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  const hasDate1 = mapped.some((c) => c.suggestedField === "date1");
  let idEmitted = false;

  for (const col of mapped) {
    const field = col.suggestedField as InternalFieldKey;
    const scriptName = SCRIPT_FIELD_LABELS[field] ?? field;
    const colIndex1Based = col.colIndex + 1;
    const fmt = col.dateFormat || col.detectedDateFormat || "DD.MM.YYYY";

    if (field === "date1" && !idEmitted) {
      lines.push(`ID;${getIdPattern(fmt)};${colIndex1Based}`);
      idEmitted = true;
    }
    if (field === "date1") {
      lines.push(`${scriptName};${colIndex1Based};${fmt}`);
    } else {
      lines.push(`${scriptName};${colIndex1Based}`);
    }
  }

  return lines.join("\n");
}

/**
 * Konverterer vår CsvParserConfig til script-tekst (for nedlasting/referanse).
 * columns i config er 0-based indeks.
 */
export function configToScript(config: CsvParserConfig): string {
  const cols = config.columns;
  const separator = config.delimiter ?? ";";
  const textQualifier = '"';

  const columnEntries = Object.entries(cols).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number"
  );

  const lines: string[] = [
    "FILTYPE;TEGNSEPARERT",
    "BARENYE;Dato1;",
    "BARENYE;Belop;",
  ];

  if (separator === "\t") {
    lines.push("SEPARATORTEGN;CHR(9)");
  } else {
    lines.push(`SEPARATORTEGN;${separator};`);
  }
  lines.push("TEKSTKVALIFIKATOR;\"");
  lines.push("[TRANSER]");

  const scriptNames: Record<string, string> = {
    date1: "Dato1",
    amount: "Belop",
    reference: "Ref",
    description: "Tekst",
  };

  for (const [internalKey, colIndex] of columnEntries) {
    const idx = colIndex + 1; // script format is 1-based
    const scriptName = scriptNames[internalKey] ?? internalKey;
    if (internalKey === "date1") {
      lines.push(`${scriptName};${idx};DD.MM.YYYY`);
    } else {
      lines.push(`${scriptName};${idx}`);
    }
  }

  return lines.join("\n");
}

export type LineType =
  | "filtype"
  | "barenye"
  | "separator"
  | "section"
  | "field-date"
  | "field"
  | "blank";

export function classifyLine(line: string): LineType {
  if (!line.trim()) return "blank";
  if (line.startsWith("FILTYPE") || line.startsWith("FILETYPE")) return "filtype";
  if (line.startsWith("BARENYE")) return "barenye";
  if (line.startsWith("SEPARATORTEGN") || line.startsWith("TEKSTKVALIFIKATOR"))
    return "separator";
  if (line.startsWith("[")) return "section";
  const parts = line.split(";");
  if (
    parts.length >= 3 &&
    (parts[0] === "Dato1" ||
      parts[0] === "Dato2" ||
      (parts[0] === "ID" && parts[1].includes("?")))
  ) {
    return "field-date";
  }
  return "field";
}
