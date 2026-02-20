/**
 * Parser for fastlengde TXT-filer: Nordea «klink», Nornett, DNB Telepay (FASTLENGDEMULTILINE).
 * Spec: FILTYPE, BEHANDL1, FACTOR, [Transer] med ID, evt. MULTILINESEGMENTID, felt (start,lengde[,linjenr]); Fortegn over Belop ved FORTEGN.
 */
import type { ParsedTransaction, ParseResult, KlinkParserConfig } from "./types";

/** Feltdefinisjon: 1-basert start, lengde, valgfri linjenr (1-based) i multiline, valgfri format. */
interface KlinkFieldDef {
  name: string;
  start: number;
  length: number;
  /** 1-basert linjenummer innenfor multiline-post (DNB Telepay). */
  lineNo?: number;
  format?: string;
}

/** Parset spec. */
interface ParsedKlinkSpec {
  recordId: string;
  idStart: number;
  idLength: number;
  /** DNB Telepay: segment-ID for fortsettelseslinjer (f.eks. SWI07). */
  segmentId?: string;
  segmentIdStart?: number;
  segmentIdLength?: number;
  fields: KlinkFieldDef[];
  behandl1: Map<string, string>;
  factor?: number;
}

const FIELD_TO_INTERNAL: Record<string, keyof ParsedTransaction> = {
  Kontonr: "accountNumber",
  Dato1: "date1",
  Dato2: "date1", // kan brukes som date1 hvis Dato1 mangler
  Belop: "amount",
  Ref: "reference",
  Tekst: "description",
  Tekstkode: "textCode",
  Dim1: "dim1",
  Dim2: "dim2",
  Dim3: "dim3",
  Dim4: "dim4",
  Dim5: "dim5",
  Dim6: "dim6",
  Dim7: "dim7",
};

function parseBehandl1(line: string): Map<string, string> {
  const map = new Map<string, string>();
  const parts = line.split(";").slice(1); // drop "BEHANDL1"
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const key = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    if (key && val !== undefined) map.set(key, val);
  }
  return map;
}

function parseFactor(line: string): number | undefined {
  const trimmed = line.trim();
  if (!trimmed.toUpperCase().startsWith("FACTOR;")) return undefined;
  const val = trimmed.slice(7).trim().replace(",", ".");
  const n = parseFloat(val);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseTranserSection(lines: string[]): ParsedKlinkSpec | null {
  let recordId: string | null = null;
  let idStart = 1;
  let idLength = 3;
  let segmentId: string | undefined;
  let segmentIdStart: number | undefined;
  let segmentIdLength: number | undefined;
  const fields: KlinkFieldDef[] = [];
  let behandl1 = new Map<string, string>();
  let factor: number | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("BEHANDL1;")) {
      behandl1 = parseBehandl1(trimmed);
    }
    const f = parseFactor(line);
    if (f !== undefined) factor = f;
  }
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.toUpperCase().startsWith("[TRANSER]")) {
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (l.startsWith("[")) break;
        if (!l) continue;
        if (l.toUpperCase().startsWith("ID;")) {
          const idParts = l.split(";");
          if (idParts.length >= 4) {
            recordId = idParts[1].trim();
            idStart = parseInt(idParts[2].trim(), 10) || 1;
            idLength = parseInt(idParts[3].trim(), 10) || 3;
          }
          continue;
        }
        if (l.toUpperCase().startsWith("MULTILINESEGMENTID;")) {
          const segParts = l.split(";");
          if (segParts.length >= 4) {
            segmentId = segParts[1].trim();
            segmentIdStart = parseInt(segParts[2].trim(), 10) || idStart;
            segmentIdLength = parseInt(segParts[3].trim(), 10) || idLength;
          }
          continue;
        }
        const semicolon = l.indexOf(";");
        if (semicolon <= 0) continue;
        const name = l.slice(0, semicolon).trim();
        const rest = l.slice(semicolon + 1);
        const firstPart = rest.split(";")[0].trim();
        const formatPart = rest.includes(";") ? rest.split(";").slice(1).join(";").trim() : undefined;
        const parts = firstPart.split(",").map((x) => parseInt(x.trim(), 10));
        const startLen = parts[0];
        const lenLen = parts[1];
        const lineNo = parts.length >= 3 && Number.isFinite(parts[2]) ? parts[2] : undefined;
        if (!name || !Number.isFinite(startLen) || !Number.isFinite(lenLen)) continue;
        fields.push({
          name,
          start: startLen,
          length: lenLen,
          lineNo,
          format: formatPart || undefined,
        });
      }
      break;
    }
  }

  if (!recordId || fields.length === 0) return null;
  return {
    recordId,
    idStart,
    idLength,
    segmentId,
    segmentIdStart,
    segmentIdLength,
    fields,
    behandl1,
    factor,
  };
}

export function parseKlinkSpec(specText: string): { spec: ParsedKlinkSpec; errors: string[] } {
  const errors: string[] = [];
  const lines = specText.split(/\r?\n/).map((l) => l.trim());
  const spec = parseTranserSection(lines);
  if (!spec) {
    errors.push("Fant ikke [Transer] med ID og feltdefinisjoner i spec");
    return {
      spec: {
        recordId: "151",
        idStart: 1,
        idLength: 3,
        fields: [],
        behandl1: new Map(),
      },
      errors,
    };
  }
  return { spec, errors };
}

function applyFortegn(fortegnChar: string, behandl1: Map<string, string>): "+" | "-" {
  const mapped = behandl1.get(fortegnChar);
  if (mapped === undefined) return "+";
  if (mapped.includes("-") || mapped === "-") return "-";
  return "+";
}

function applyFactor(amountStr: string, factor: number): string {
  const num = parseFloat(amountStr.replace(",", ".").replace(/\s/g, "")) || 0;
  const scaled = num * factor;
  if (Number.isInteger(scaled)) return String(scaled);
  return scaled.toFixed(2).replace(/\.?0+$/, "") || "0";
}

function extract(line: string, start: number, length: number): string {
  const from = Math.max(0, start - 1);
  return line.slice(from, from + length).trim();
}

function dateToIso(value: string, format?: string): string {
  const s = value.replace(/\s/g, "");
  if (format === "YYYYMMDD" && s.length >= 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if ((format === "YYMMDD" || !format) && s.length >= 6) {
    const yy = s.slice(0, 2);
    const mm = s.slice(2, 4);
    const dd = s.slice(4, 6);
    const y = parseInt(yy, 10);
    const year = y >= 0 && y <= 99 ? (y >= 50 ? 1900 + y : 2000 + y) : 2000 + (y % 100);
    return `${year}-${mm}-${dd}`;
  }
  return value;
}

function applySignBit(
  rawAmount: string,
  behandl1: Map<string, string>
): { amount: string; sign: "+" | "-" } {
  if (rawAmount.length === 0) return { amount: "0", sign: "+" };
  const lastChar = rawAmount.slice(-1);
  const mapped = behandl1.get(lastChar);
  let digits = rawAmount.slice(0, -1);
  let sign: "+" | "-" = "+";
  if (mapped !== undefined) {
    if (mapped.startsWith("-")) {
      sign = "-";
      const digitPart = mapped.slice(1).replace(/\D/g, "");
      digits = digits + (digitPart || "0");
    } else {
      digits = digits + mapped.replace(/\D/g, "").slice(-1);
    }
  } else {
    digits = rawAmount.replace(/\D/g, "");
  }
  const amount = digits.replace(/^0+/, "") || "0";
  return { amount, sign };
}

/** Bygger multiline-records: hver post er [recordId-linje, ...segmentId-linjer]. */
function buildMultilineRecords(
  lines: string[],
  parsed: ParsedKlinkSpec
): string[][] {
  const idStart0 = Math.max(0, parsed.idStart - 1);
  const segStart0 =
    parsed.segmentId != null && parsed.segmentIdStart != null && parsed.segmentIdLength != null
      ? Math.max(0, parsed.segmentIdStart - 1)
      : idStart0;
  const segLen = parsed.segmentIdLength ?? parsed.idLength;
  const records: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineType = line.slice(idStart0, idStart0 + parsed.idLength);
    if (lineType === parsed.recordId) {
      const record: string[] = [line];
      if (parsed.segmentId != null) {
        for (let j = i + 1; j < lines.length; j++) {
          const segType = lines[j].slice(segStart0, segStart0 + segLen);
          if (segType !== parsed.segmentId) break;
          record.push(lines[j]);
          i = j;
        }
      }
      records.push(record);
    }
  }
  return records;
}

export function parseKlink(content: string, config: KlinkParserConfig): ParseResult {
  const errors: string[] = [];
  const { spec: parsed, errors: specErrors } = parseKlinkSpec(config.spec);
  errors.push(...specErrors);

  if (parsed.fields.length === 0) {
    return { transactions: [], errors };
  }

  const allLines = content.split(/\r?\n/).map((l) => l.trimEnd());
  const records = buildMultilineRecords(allLines, parsed);
  const transactions: ParsedTransaction[] = [];

  for (const recordLines of records) {
    const raw: Record<string, string> = {};
    for (const f of parsed.fields) {
      const lineIndex = (f.lineNo ?? 1) - 1;
      const line = recordLines[lineIndex];
      let val = line ? extract(line, f.start, f.length) : "";
      if ((f.format === "YYMMDD" || f.format === "YYYYMMDD") && val.length >= 6) {
        val = dateToIso(val, f.format);
      }
      raw[f.name] = val;
    }

    let amountRaw = raw["Belop"] ?? raw["amount"] ?? "";
    let sign: "+" | "-" | null = null;
    const amountField = parsed.fields.find((x) => x.name === "Belop" || x.name === "amount");
    if (amountField?.format === "SIGNBIT" && amountRaw.length > 0) {
      const res = applySignBit(amountRaw, parsed.behandl1);
      amountRaw = res.amount;
      sign = res.sign;
    } else if (amountField?.format === "FORTEGN") {
      const fortegnChar = (raw["Fortegn"] ?? "").trim().slice(0, 1);
      sign = applyFortegn(fortegnChar, parsed.behandl1);
      amountRaw = amountRaw.replace(/\D/g, "");
    }
    if (!amountRaw || amountRaw === "") continue;
    if (parsed.factor != null && parsed.factor !== 1) {
      amountRaw = applyFactor(amountRaw, parsed.factor);
    }

    const date1 = raw["Dato1"] || raw["Dato2"] || "";
    const tx: ParsedTransaction = {
      amount: amountRaw,
      date1: date1 || "1970-01-01",
      sign: sign ?? undefined,
      accountNumber: raw["Kontonr"] || undefined,
      reference: raw["Ref"] || undefined,
      description: raw["Tekst"] || undefined,
      textCode: raw["Tekstkode"] || undefined,
      dim1: raw["Dim1"] || undefined,
      dim2: raw["Dim2"] || undefined,
      dim3: raw["Dim3"] || undefined,
      dim4: raw["Dim4"] || undefined,
      dim5: raw["Dim5"] || undefined,
      dim6: raw["Dim6"] || undefined,
      dim7: raw["Dim7"] || undefined,
    };
    if (!tx.accountNumber) delete tx.accountNumber;
    if (!tx.reference) delete tx.reference;
    if (!tx.description) delete tx.description;
    if (!tx.textCode) delete tx.textCode;
    transactions.push(tx);
  }

  return { transactions, errors };
}
