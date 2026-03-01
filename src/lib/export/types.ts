import type { MvaMelding, MvaDifferansekategori } from "@/lib/mva/demo-data";

// ── Formats & Modules ──────────────────────────────────────────────

export type ExportFormat = "pdf" | "xlsx";
export type ExportModule = "mva" | "matching" | "comparison" | "group-matching";

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

export interface ComparisonExportPayload {
  clients: {
    id: string;
    name: string;
    companyName: string;
    set1AccountNumber: string;
    set2AccountNumber: string;
    openingBalanceSet1: number;
    openingBalanceSet2: number;
    balanceSet1: number;
    balanceSet2: number;
    unmatchedSumSet1: number;
    unmatchedSumSet2: number;
    unmatchedCountSet1: number;
    unmatchedCountSet2: number;
  }[];
  totals: {
    nettoSet1: number;
    nettoSet2: number;
    totalUnmatchedCount: number;
  };
}

export interface GroupMatchingExportPayload {
  groupId: string;
  groupName: string;
  clientIds: string[];
  reportType: "open";
}

export interface GroupMatchingClientSection {
  klientNavn: string;
  companyName?: string;
  set1Label: string;
  set2Label: string;
  aapneSet1: MatchingTransactionExport[];
  aapneSet2: MatchingTransactionExport[];
  totalSet1: number;
  totalSet2: number;
  saldoSet1: number;
  saldoSet2: number;
  matchCount: number;
  matchProsent: number;
}

export interface GroupMatchingExportViewModel {
  groupName: string;
  clientCount: number;
  sections: GroupMatchingClientSection[];
  totals: {
    totalOpenSet1: number;
    totalOpenSet2: number;
    totalSaldoSet1: number;
    totalSaldoSet2: number;
    totalMatches: number;
  };
  genererTidspunkt: string;
  generatedBy?: string;
}

export interface ExportRequest {
  module: ExportModule;
  format: ExportFormat;
  mvaData?: MvaExportPayload;
  matchingParams?: MatchingExportPayload;
  comparisonData?: ComparisonExportPayload;
  groupMatchingData?: GroupMatchingExportPayload;
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

  // Saldo — sum of ALL transactions (matched + unmatched) per set
  saldoSet1?: number;
  saldoSet2?: number;
  totalPosterSet1?: number;
  totalPosterSet2?: number;

  // Match summary
  matchCount?: number;
  matchedTransactionCount?: number;
  matchProsent?: number;

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
