import type { MvaMelding, MvaDifferansekategori } from "@/lib/mva/demo-data";

// ── Formats & Modules ──────────────────────────────────────────────

export type ExportFormat = "pdf" | "xlsx";
export type ExportModule = "mva" | "matching";

// ── Request types ──────────────────────────────────────────────────

export interface MvaExportPayload {
  melding: MvaMelding;
  lineOverrides: Record<string, { category: MvaDifferansekategori | ""; comment: string }>;
}

export interface MatchingExportPayload {
  clientId: string;
  reportType: "open" | "closed";
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportRequest {
  module: ExportModule;
  format: ExportFormat;
  mvaData?: MvaExportPayload;
  matchingParams?: MatchingExportPayload;
}

// ── Result ─────────────────────────────────────────────────────────

export interface ExportResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

// ── View models (consumed by templates) ────────────────────────────

export interface MvaExportLine {
  mvaKode: string;
  beskrivelse: string;
  grunnlag: number;
  sats: number;
  beregnet: number;
  bokfort: number;
  differanse: number;
  aarsak: string;
  kommentar: string;
}

export interface MvaExportViewModel {
  termin: string;
  totalBeregnet: number;
  totalBokfort: number;
  totalDifferanse: number;
  linjer: MvaExportLine[];
  genererTidspunkt: string;
  /** Selskapsnavn for branding (valgfri, f.eks. fra valgt selskap). */
  companyName?: string;
  /** E-post til bruker som genererte rapporten. */
  generatedBy?: string;
  /** Base64 data URL for logo (valgfri). */
  companyLogoDataUrl?: string;
}

export interface MatchingTransactionExport {
  dato: string;
  bilag: string;
  beskrivelse: string;
  belop: number;
}

export interface MatchingMatchGroupExport {
  matchDato: string;
  type: string;
  differanse: number;
  transaksjonerSet1: MatchingTransactionExport[];
  transaksjonerSet2: MatchingTransactionExport[];
}

export interface MatchingExportViewModel {
  klientNavn: string;
  set1Label: string;
  set2Label: string;
  reportType: "open" | "closed";
  datoPeriode: string;
  // Open report
  aapneSet1?: MatchingTransactionExport[];
  aapneSet2?: MatchingTransactionExport[];
  antallSet1?: number;
  antallSet2?: number;
  totalSet1?: number;
  totalSet2?: number;
  // Closed report
  matcher?: MatchingMatchGroupExport[];
  antallMatcher?: number;
  totalMatchet?: number;
  genererTidspunkt: string;
  /** Selskapsnavn (klientens selskap) for branding. */
  companyName?: string;
  /** E-post til bruker som genererte rapporten. */
  generatedBy?: string;
  /** Base64 data URL for logo (valgfri). */
  companyLogoDataUrl?: string;
}

// ── Template contract ──────────────────────────────────────────────

export interface ExportTemplate<TViewModel> {
  buildViewModel: (payload: unknown, context: ExportContext) => Promise<TViewModel>;
  renderPdf?: (vm: TViewModel) => Promise<Buffer>;
  renderXlsx?: (vm: TViewModel) => Promise<Buffer>;
}

export interface ExportContext {
  tenantId: string;
  userId: string;
  /** E-post til innlogget bruker (for «Skrevet ut av»). */
  userEmail?: string;
}
