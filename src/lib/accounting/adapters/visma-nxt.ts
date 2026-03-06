import type {
  AccountingSystemAdapter,
  PayrollData,
  VatTransaction,
  VatSummary,
  VatSummaryLine,
  ReceivableEntry,
  PayableEntry,
  TrialBalanceEntry,
  HolidayPayData,
  PeriodParams,
} from "../types";
import { NotSupportedError } from "../types";
import type { SystemCredentials } from "../registry";
import { query, fetchAllPages } from "@/lib/visma-nxt/client";
import { getCompanyNo } from "@/lib/visma-nxt/auth";
import { mapReceivable, mapPayable } from "@/lib/visma-nxt/mappers";
import {
  GET_COMPANIES,
  GET_VAT_TRANSACTIONS,
  GET_CUSTOMER_TRANSACTIONS,
  GET_SUPPLIER_TRANSACTIONS,
} from "@/lib/visma-nxt/queries";
import type {
  VnxtCompany,
  VnxtTransaction,
  VnxtCustomerTransaction,
  VnxtSupplierTransaction,
  VnxtPaginatedResponse,
} from "@/lib/visma-nxt/types";

// ---------------------------------------------------------------------------
// Helper: period to filter params
// ---------------------------------------------------------------------------

function periodToFilters(params: PeriodParams): {
  year: number;
  periodFrom: number;
  periodTo: number;
} {
  if (params.month) {
    return { year: params.year, periodFrom: params.month, periodTo: params.month };
  }
  if (params.quarter) {
    const start = (params.quarter - 1) * 3 + 1;
    return { year: params.year, periodFrom: start, periodTo: start + 2 };
  }
  return { year: params.year, periodFrom: 1, periodTo: 12 };
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

export function createVismaNxtAdapter(
  creds: SystemCredentials
): AccountingSystemAdapter {
  const tenantId = creds.tenantId;

  return {
    systemId: "visma_nxt",
    systemName: "Visma Business NXT",

    async testConnection(): Promise<boolean> {
      try {
        const data = await query<{ availableCompanies: VnxtCompany[] }>(
          tenantId,
          GET_COMPANIES
        );
        return Array.isArray(data.availableCompanies) && data.availableCompanies.length > 0;
      } catch {
        return false;
      }
    },

    async getPayrollData(_params: PeriodParams): Promise<PayrollData> {
      throw new NotSupportedError(
        "visma_nxt",
        "getPayrollData"
      );
    },

    async getVatTransactions(params: PeriodParams): Promise<VatTransaction[]> {
      const companyNo = await getCompanyNo(tenantId);
      const { year, periodFrom, periodTo } = periodToFilters(params);

      interface VatTxData {
        useCompany: {
          generalLedgerTransaction: VnxtPaginatedResponse<
            VnxtTransaction & { taxCode: string | null }
          >;
        };
      }

      const allTx = await fetchAllPages<
        VnxtTransaction & { taxCode: string | null },
        VatTxData
      >(
        tenantId,
        GET_VAT_TRANSACTIONS,
        { companyNo, year, periodFrom, periodTo },
        (data) => data.useCompany.generalLedgerTransaction
      );

      return allTx
        .filter((t) => t.taxCode)
        .map((t) => {
          const amount = t.postedAmountDomestic ?? 0;
          return {
            date: t.voucherDate
              ? new Date(t.voucherDate)
              : new Date(t.year, t.period - 1, 1),
            voucherNumber: t.voucherNo != null ? String(t.voucherNo) : "",
            description: t.description ?? "",
            accountNumber: String(t.accountNo),
            vatCode: t.taxCode!,
            netAmount: amount,
            vatAmount: 0,
            grossAmount: amount,
          };
        });
    },

    async getVatSummary(params: PeriodParams): Promise<VatSummary> {
      const vatTx = await this.getVatTransactions(params);

      const codeMap = new Map<string, VatSummaryLine>();

      for (const tx of vatTx) {
        const existing = codeMap.get(tx.vatCode);
        if (existing) {
          existing.basis += tx.netAmount;
          existing.vatAmount += tx.vatAmount;
        } else {
          codeMap.set(tx.vatCode, {
            vatCode: tx.vatCode,
            description: `MVA-kode ${tx.vatCode}`,
            basis: tx.netAmount,
            rate: 0,
            vatAmount: tx.vatAmount,
          });
        }
      }

      for (const line of codeMap.values()) {
        if (line.basis !== 0) {
          line.rate =
            Math.round(
              (Math.abs(line.vatAmount / line.basis) * 100) * 100
            ) / 100;
        }
      }

      const lines = Array.from(codeMap.values());
      return {
        period: params,
        lines,
        totalBasis: lines.reduce((s, l) => s + l.basis, 0),
        totalVat: lines.reduce((s, l) => s + l.vatAmount, 0),
      };
    },

    async getAccountsReceivable(asOfDate: Date): Promise<ReceivableEntry[]> {
      const companyNo = await getCompanyNo(tenantId);

      interface CustTxData {
        useCompany: {
          customerTransaction: VnxtPaginatedResponse<VnxtCustomerTransaction>;
        };
      }

      const allTx = await fetchAllPages<VnxtCustomerTransaction, CustTxData>(
        tenantId,
        GET_CUSTOMER_TRANSACTIONS,
        { companyNo },
        (data) => data.useCompany.customerTransaction
      );

      return allTx
        .filter((t) => Math.abs(t.remainingAmount) > 0.01)
        .map((t) => {
          const mapped = mapReceivable(t);
          return {
            customerId: mapped.customerId,
            customerName: mapped.customerName,
            invoiceNumber: mapped.invoiceNumber,
            invoiceDate: mapped.invoiceDate,
            dueDate: mapped.dueDate,
            originalAmount: mapped.originalAmount,
            remainingAmount: mapped.remainingAmount,
            currency: mapped.currency,
          };
        });
    },

    async getAccountsPayable(asOfDate: Date): Promise<PayableEntry[]> {
      const companyNo = await getCompanyNo(tenantId);

      interface SuppTxData {
        useCompany: {
          supplierTransaction: VnxtPaginatedResponse<VnxtSupplierTransaction>;
        };
      }

      const allTx = await fetchAllPages<VnxtSupplierTransaction, SuppTxData>(
        tenantId,
        GET_SUPPLIER_TRANSACTIONS,
        { companyNo },
        (data) => data.useCompany.supplierTransaction
      );

      return allTx
        .filter((t) => Math.abs(t.remainingAmount) > 0.01)
        .map((t) => {
          const mapped = mapPayable(t);
          return {
            supplierId: mapped.supplierId,
            supplierName: mapped.supplierName,
            invoiceNumber: mapped.invoiceNumber,
            invoiceDate: mapped.invoiceDate,
            dueDate: mapped.dueDate,
            originalAmount: mapped.originalAmount,
            remainingAmount: mapped.remainingAmount,
            currency: mapped.currency,
          };
        });
    },

    async getTrialBalance(_params: PeriodParams, _accountFilter?: string[]): Promise<TrialBalanceEntry[]> {
      throw new NotSupportedError("visma_nxt", "getTrialBalance");
    },

    async getHolidayPayData(_year: number): Promise<HolidayPayData> {
      throw new NotSupportedError(
        "visma_nxt",
        "getHolidayPayData"
      );
    },
  };
}
