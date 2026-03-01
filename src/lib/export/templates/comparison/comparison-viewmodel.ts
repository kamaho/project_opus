import type { ExportContext } from "../../types";

export interface ComparisonClientData {
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
}

export interface ComparisonExportPayload {
  clients: ComparisonClientData[];
  totals: {
    nettoSet1: number;
    nettoSet2: number;
    totalUnmatchedCount: number;
  };
}

export interface ComparisonExportViewModel {
  clients: ComparisonClientData[];
  totals: {
    nettoSet1: number;
    nettoSet2: number;
    totalUnmatchedCount: number;
  };
  genererTidspunkt: string;
  generatedBy?: string;
}

export async function buildComparisonViewModel(
  payload: ComparisonExportPayload,
  context: ExportContext
): Promise<ComparisonExportViewModel> {
  return {
    clients: payload.clients,
    totals: payload.totals,
    genererTidspunkt: new Date().toISOString(),
    generatedBy: context.userEmail,
  };
}
