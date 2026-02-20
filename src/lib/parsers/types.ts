/**
 * Internal transaction fields (DOMAIN_SPEC) — used by all parsers.
 */
export interface ParsedTransaction {
  accountNumber?: string | null;
  currency?: string | null;
  amount: string;
  foreignAmount?: string | null;
  date1: string; // YYYY-MM-DD
  date2?: string | null;
  reference?: string | null;
  description?: string | null;
  textCode?: string | null;
  dim1?: string | null;
  dim2?: string | null;
  dim3?: string | null;
  dim4?: string | null;
  dim5?: string | null;
  dim6?: string | null;
  dim7?: string | null;
  dim8?: string | null;
  dim9?: string | null;
  dim10?: string | null;
  sign?: "+" | "-" | null;
  buntref?: string | null;
  notat?: string | null;
  bilag?: string | null;
  faktura?: string | null;
  forfall?: string | null;
  periode?: string | null;
  importNumber?: string | null;
  avgift?: string | null;
  tilleggstekst?: string | null;
  ref2?: string | null;
  ref3?: string | null;
  ref4?: string | null;
  ref5?: string | null;
  ref6?: string | null;
  anleggsnr?: string | null;
  anleggsbeskrivelse?: string | null;
  bilagsart?: string | null;
  avsnr?: string | null;
  tid?: string | null;
  avvikendeDato?: string | null;
  rate?: string | null;
  kundenavn?: string | null;
  kontonummerBokføring?: string | null;
}

export type ParserFileType = "csv" | "excel" | "camt" | "xml" | "fixed";

export interface CsvParserConfig {
  delimiter: ";" | "," | "\t";
  decimalSeparator: "." | ",";
  hasHeader: boolean;
  /** Map: internal field name -> column index (0-based) or header name */
  columns: Record<string, number | string>;
  /** If true, treat negative amounts as sign already set */
  signFromAmount?: boolean;
  /** Skip this many rows before header/data (for files where header is not on row 0). */
  dataStartRow?: number;
}

export interface CamtParserConfig {
  /** Optional namespace overrides for XML */
  namespaces?: Record<string, string>;
}

export interface KlinkParserConfig {
  /** Hele spec-teksten (FILTYPE, BEHANDL1, [Transer] med ID og feltdefinisjoner). */
  spec: string;
}

export interface ExcelParserConfig {
  /** 0-basert rad der dataradene starter (første rad etter evt. header). */
  dataStartRow: number;
  /** Map: internt felt → 0-basert kolonneindeks. */
  columns: Record<string, number>;
  /** Datoformat per felt (f.eks. date1: "DD.MM.YYYY"). Standard for dato er DD.MM.YYYY. */
  dateFormats?: Record<string, string>;
  /** Hent verdier fra header-område (f.eks. Kontonr fra celle ved siden av "Kontonr."). */
  headerExtractions?: Array<{ field: string; label: string; columnOffset?: number }>;
  /** 0-basert ark-indeks. */
  sheetIndex?: number;
}

export type ParserConfig = CsvParserConfig | CamtParserConfig | KlinkParserConfig | ExcelParserConfig;

export interface RowIssue {
  rowIndex: number;
  rowNumber: number;
  field: string;
  value: string;
  reason: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  errors: string[];
  skippedRows?: RowIssue[];
}
