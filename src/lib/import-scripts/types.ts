/**
 * Feltnavn og formater for import-script og auto-mapping.
 * Tilsvarer script_builder AC-felt; mapes til parsers/types (date1, amount, reference, description, osv.).
 */

export type SeparatorChar = ";" | "," | "\t" | "|";
export type DataType = "date" | "number" | "text";

/** Interne feltnavn som våre parsere bruker (CsvParserConfig.columns). Inkl. kredit/debit og felter fra gamle løsningen. */
export const INTERNAL_FIELDS = [
  "date1",
  "date2",
  "amount",
  "credit",
  "debit",
  "description",
  "reference",
  "accountNumber",
  "currency",
  "foreignAmount",
  "textCode",
  "dim1",
  "dim2",
  "dim3",
  "dim4",
  "dim5",
  "dim6",
  "dim7",
  "dim8",
  "dim9",
  "dim10",
  "buntref",
  "notat",
  "bilag",
  "faktura",
  "forfall",
  "periode",
  "importNumber",
  "avgift",
  "tilleggstekst",
  "ref2",
  "ref3",
  "ref4",
  "ref5",
  "ref6",
  "anleggsnr",
  "anleggsbeskrivelse",
  "bilagsart",
  "avsnr",
  "tid",
  "avvikendeDato",
  "rate",
  "kundenavn",
  "kontonummerBokføring",
  "sign",
] as const;

export type InternalFieldKey = (typeof INTERNAL_FIELDS)[number];

/** Script/AC-feltnavn (brukes i generert script og dokumentasjon) */
export const SCRIPT_FIELD_LABELS: Record<string, string> = {
  date1: "Dato 1",
  date2: "Dato 2",
  amount: "Beløp",
  credit: "Kredit",
  debit: "Debit",
  description: "Tekst",
  reference: "Ref",
  accountNumber: "Kontonr",
  currency: "Valuta",
  foreignAmount: "Valutabeløp",
  textCode: "Tekstkode",
  dim1: "Dim 1",
  dim2: "Dim 2",
  dim3: "Dim 3",
  dim4: "Dim 4",
  dim5: "Dim 5",
  dim6: "Dim 6",
  dim7: "Dim 7",
  dim8: "Dim 8",
  dim9: "Dim 9",
  dim10: "Dim 10",
  buntref: "Buntref",
  notat: "Notat",
  bilag: "Bilag",
  faktura: "Faktura",
  forfall: "Forfall",
  periode: "Periode",
  importNumber: "Importnummer",
  avgift: "Avgift",
  tilleggstekst: "Tilleggstekst",
  ref2: "Ref 2",
  ref3: "Ref 3",
  ref4: "Ref 4",
  ref5: "Ref 5",
  ref6: "Ref 6",
  anleggsnr: "Anleggsnr.",
  anleggsbeskrivelse: "Anleggsbeskrivelse",
  bilagsart: "Bilagsart",
  avsnr: "Avsnr.",
  tid: "Tid",
  avvikendeDato: "Avvikende dato",
  rate: "Rate",
  kundenavn: "Kundenavn",
  kontonummerBokføring: "Kontonummer for bokføring",
  sign: "Fortegn",
};

/** Rekkefølge for script-output (viktige felt først) */
export const FIELD_ORDER: InternalFieldKey[] = [
  "date1",
  "date2",
  "amount",
  "credit",
  "debit",
  "reference",
  "description",
  "accountNumber",
  "currency",
  "foreignAmount",
  "textCode",
  "dim1",
  "dim2",
  "dim3",
  "dim4",
  "dim5",
  "dim6",
  "dim7",
  "dim8",
  "dim9",
  "dim10",
  "buntref",
  "notat",
  "bilag",
  "faktura",
  "forfall",
  "periode",
  "importNumber",
  "avgift",
  "tilleggstekst",
  "ref2",
  "ref3",
  "ref4",
  "ref5",
  "ref6",
  "anleggsnr",
  "anleggsbeskrivelse",
  "bilagsart",
  "avsnr",
  "tid",
  "avvikendeDato",
  "rate",
  "kundenavn",
  "kontonummerBokføring",
  "sign",
];

export const DATE_FORMATS = [
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (31.12.2024)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY (31-12-2024)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-12-31)" },
  { value: "YYYYMMDD", label: "YYYYMMDD (20241231)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2024)" },
] as const;

/** Én kolonne i en fil med forslog til mapping og format */
export interface ColumnMapping {
  /** 0-based kolonneindeks */
  colIndex: number;
  header: string;
  samples: string[];
  detectedType: DataType;
  detectedDateFormat: string;
  /** Forslag til internt felt (date1, amount, osv.) fra header/samples; "none" = bruker valgte «— Ingen» */
  suggestedField: InternalFieldKey | "" | "none";
  /** Bruker valgt eller auto-detect datoformat */
  dateFormat: string;
}

/** Resultat av å lese en fil (for forhåndsvisning og script-generering) */
export interface ParsedFileMeta {
  fileName: string;
  columns: ColumnMapping[];
  separator: SeparatorChar;
  hasTextQualifier: boolean;
  textQualifier: string;
  hasHeaderRow: boolean;
  previewHeaders: string[];
  previewRows: string[][];
}
