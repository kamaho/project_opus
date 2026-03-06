import type {
  AccountingSystemAdapter,
  PayrollData,
  PayrollEmployee,
  PayrollBenefit,
  VatTransaction,
  VatSummary,
  VatSummaryLine,
  ReceivableEntry,
  PayableEntry,
  TrialBalanceEntry,
  HolidayPayData,
  HolidayPayEmployee,
  PeriodParams,
} from "../types";
import { NotSupportedError } from "../types";
import type { SystemCredentials } from "../registry";
import { tripletexGet, tripletexWhoAmI } from "@/lib/tripletex";
import { fetchAllPages } from "@/lib/tripletex/pagination";

// ---------------------------------------------------------------------------
// Tripletex API response types (specific to this adapter)
// ---------------------------------------------------------------------------

interface TxPayslip {
  id: number;
  employee?: { id: number; firstName?: string; lastName?: string };
  date?: string;
  year?: number;
  month?: number;
  grossAmount?: number;
  amount?: number; // net
  payslipGeneralInfo?: {
    personalIncomeTax?: number;
    employerContribution?: number;
    pensionAmount?: number;
    otherDeductions?: number;
  };
  specifications?: TxPayslipSpec[];
}

interface TxPayslipSpec {
  specificationtype?: string;
  rate?: number;
  amount?: number;
  description?: string;
  supplementaryInformationCode?: string;
}

interface TxInvoice {
  id: number;
  invoiceNumber?: number;
  invoiceDate?: string;
  invoiceDueDate?: string;
  amount?: number;
  amountOutstanding?: number;
  amountCurrency?: number;
  currency?: { code?: string };
  customer?: { id: number; name?: string; customerNumber?: number };
}

interface TxSupplierInvoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  invoiceDueDate?: string;
  amount?: number;
  amountCurrency?: number;
  amountOutstanding?: number;
  currency?: string | { code?: string };
  supplier?: { id: number; name?: string; supplierNumber?: number };
}

interface TxLedgerPosting {
  id: number;
  date?: string;
  description?: string;
  amount?: number;
  amountGross?: number;
  account?: { number?: number };
  voucher?: { number?: number };
  vatType?: { id?: number; number?: number; name?: string; percentage?: number };
}

// ---------------------------------------------------------------------------
// Helper: period date range
// ---------------------------------------------------------------------------

function periodDateRange(params: PeriodParams): { dateFrom: string; dateTo: string } {
  if (params.month) {
    const y = params.year;
    const m = String(params.month).padStart(2, "0");
    const lastDay = new Date(y, params.month, 0).getDate();
    return {
      dateFrom: `${y}-${m}-01`,
      dateTo: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (params.quarter) {
    const startMonth = (params.quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(params.year, endMonth, 0).getDate();
    return {
      dateFrom: `${params.year}-${String(startMonth).padStart(2, "0")}-01`,
      dateTo: `${params.year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  return {
    dateFrom: `${params.year}-01-01`,
    dateTo: `${params.year}-12-31`,
  };
}

function toDate(s: string | undefined): Date {
  return s ? new Date(s) : new Date();
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

export function createTripletexAdapter(
  creds: SystemCredentials
): AccountingSystemAdapter {
  const tenantId = creds.tenantId;

  return {
    systemId: "tripletex",
    systemName: "Tripletex",

    async testConnection(): Promise<boolean> {
      try {
        const whoami = await tripletexWhoAmI(tenantId);
        return !!whoami.value?.company;
      } catch {
        return false;
      }
    },

    async getPayrollData(params: PeriodParams): Promise<PayrollData> {
      // Tripletex API: GET /v2/salary/payslip
      const payslips = await fetchAllPages<TxPayslip>(
        "/salary/payslip",
        {
          yearFrom: params.year,
          yearTo: params.year,
          ...(params.month ? { monthFrom: params.month, monthTo: params.month } : {}),
          fields: "id,employee(id,firstName,lastName),year,month,grossAmount,amount,payslipGeneralInfo,specifications(*)",
        },
        tenantId
      );

      const employeeMap = new Map<number, PayrollEmployee>();

      for (const slip of payslips) {
        const empId = slip.employee?.id;
        if (!empId) continue;

        const name = [slip.employee?.firstName, slip.employee?.lastName]
          .filter(Boolean).join(" ") || `Ansatt ${empId}`;

        const info = slip.payslipGeneralInfo;
        const gross = slip.grossAmount ?? 0;
        const tax = info?.personalIncomeTax ?? 0;
        const aga = info?.employerContribution ?? 0;
        const pension = info?.pensionAmount ?? 0;
        const other = info?.otherDeductions ?? 0;
        const net = slip.amount ?? 0;

        const benefits: PayrollBenefit[] = (slip.specifications ?? [])
          .filter((s) => s.supplementaryInformationCode)
          .map((s) => ({
            code: s.supplementaryInformationCode!,
            description: s.description ?? s.specificationtype ?? "",
            amount: s.amount ?? 0,
          }));

        const existing = employeeMap.get(empId);
        if (existing) {
          existing.grossPay += gross;
          existing.taxDeductions += tax;
          existing.employerContributions += aga;
          existing.netPay += net;
          existing.pensionContributions += pension;
          existing.benefits.push(...benefits);
        } else {
          employeeMap.set(empId, {
            employeeId: String(empId),
            name,
            grossPay: gross,
            taxDeductions: tax,
            employerContributions: aga,
            netPay: net,
            pensionContributions: pension,
            benefits,
          });
        }
      }

      const employees = Array.from(employeeMap.values());
      const totals = employees.reduce(
        (acc, e) => ({
          grossPay: acc.grossPay + e.grossPay,
          taxDeductions: acc.taxDeductions + e.taxDeductions,
          employerContributions: acc.employerContributions + e.employerContributions,
          netPay: acc.netPay + e.netPay,
          pensionContributions: acc.pensionContributions + e.pensionContributions,
          otherDeductions: acc.otherDeductions,
        }),
        { grossPay: 0, taxDeductions: 0, employerContributions: 0, netPay: 0, pensionContributions: 0, otherDeductions: 0 }
      );

      return { period: params, employees, totals };
    },

    async getVatTransactions(params: PeriodParams): Promise<VatTransaction[]> {
      // Tripletex API: GET /v2/ledger/posting — filter on entries with vatType
      const { dateFrom, dateTo } = periodDateRange(params);

      const postings = await fetchAllPages<TxLedgerPosting>(
        "/ledger/posting",
        {
          dateFrom,
          dateTo,
          fields: "id,date,description,amount,amountGross,account(number),voucher(number),vatType(id,number,name,percentage)",
        },
        tenantId
      );

      return postings
        .filter((p) => p.vatType?.number)
        .map((p) => ({
          date: toDate(p.date),
          voucherNumber: String(p.voucher?.number ?? ""),
          description: p.description ?? "",
          accountNumber: String(p.account?.number ?? ""),
          vatCode: String(p.vatType!.number),
          netAmount: p.amount ?? 0,
          vatAmount: (p.amountGross ?? 0) - (p.amount ?? 0),
          grossAmount: p.amountGross ?? 0,
        }));
    },

    async getVatSummary(params: PeriodParams): Promise<VatSummary> {
      const transactions = await this.getVatTransactions(params);

      const codeMap = new Map<string, VatSummaryLine>();

      for (const tx of transactions) {
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

      // Calculate effective rate per code
      for (const line of codeMap.values()) {
        if (line.basis !== 0) {
          line.rate = Math.round((Math.abs(line.vatAmount / line.basis) * 100) * 100) / 100;
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
      // Tripletex API: GET /v2/invoice (requires both invoiceDateFrom and invoiceDateTo)
      const dateTo = asOfDate.toISOString().split("T")[0];
      const dateFrom = new Date(asOfDate.getFullYear() - 2, 0, 1).toISOString().split("T")[0];

      const invoices = await fetchAllPages<TxInvoice>(
        "/invoice",
        {
          invoiceDateFrom: dateFrom,
          invoiceDateTo: dateTo,
          fields: "id,invoiceNumber,invoiceDate,invoiceDueDate,amount,amountOutstanding,amountCurrency,currency(code),customer(id,name,customerNumber)",
        },
        tenantId
      );

      return invoices
        .filter((inv) => (inv.amountOutstanding ?? 0) > 0)
        .map((inv) => ({
          customerId: String(inv.customer?.customerNumber ?? inv.customer?.id ?? ""),
          customerName: inv.customer?.name ?? "",
          invoiceNumber: String(inv.invoiceNumber ?? inv.id),
          invoiceDate: toDate(inv.invoiceDate),
          dueDate: toDate(inv.invoiceDueDate),
          originalAmount: inv.amount ?? 0,
          remainingAmount: inv.amountOutstanding ?? 0,
          currency: inv.currency?.code ?? "NOK",
        }));
    },

    async getAccountsPayable(asOfDate: Date): Promise<PayableEntry[]> {
      // Tripletex API: GET /v2/supplierInvoice (requires both invoiceDateFrom and invoiceDateTo)
      const dateTo = asOfDate.toISOString().split("T")[0];
      const dateFrom = new Date(asOfDate.getFullYear() - 2, 0, 1).toISOString().split("T")[0];

      const invoices = await fetchAllPages<TxSupplierInvoice>(
        "/supplierInvoice",
        {
          invoiceDateFrom: dateFrom,
          invoiceDateTo: dateTo,
        },
        tenantId
      );

      return invoices
        .filter((inv) => (inv.amountOutstanding ?? 0) > 0)
        .map((inv) => {
          const cur = typeof inv.currency === "object" ? inv.currency?.code : inv.currency;
          return {
            supplierId: String(inv.supplier?.supplierNumber ?? inv.supplier?.id ?? ""),
            supplierName: inv.supplier?.name ?? "",
            invoiceNumber: inv.invoiceNumber ?? String(inv.id),
            invoiceDate: toDate(inv.invoiceDate),
            dueDate: toDate(inv.invoiceDueDate ?? inv.dueDate),
            originalAmount: inv.amount ?? inv.amountCurrency ?? 0,
            remainingAmount: inv.amountOutstanding ?? 0,
            currency: cur ?? "NOK",
          };
        });
    },

    async getTrialBalance(params: PeriodParams, accountFilter?: string[]): Promise<TrialBalanceEntry[]> {
      const dateFrom = `${params.year}-${String(params.month ?? 1).padStart(2, "0")}-01`;
      const month = params.month ?? 12;
      const lastDay = new Date(params.year, month, 0).getDate();
      const dateTo = `${params.year}-${String(month).padStart(2, "0")}-${lastDay}`;

      interface AccountRow {
        number?: number;
        name?: string;
        openingBalance?: number;
        debitBalance?: number;
        creditBalance?: number;
        closingBalance?: number;
      }

      const data = await tripletexGet<{ values: AccountRow[] }>(
        `/v2/ledger/account`,
        { dateFrom, dateTo, count: 1000 },
        tenantId
      );

      const entries: TrialBalanceEntry[] = (data?.values ?? []).map((acc) => ({
        accountNumber: String(acc.number ?? ""),
        accountName: String(acc.name ?? ""),
        openingBalance: Number(acc.openingBalance ?? 0),
        periodDebit: Number(acc.debitBalance ?? 0),
        periodCredit: Number(acc.creditBalance ?? 0),
        closingBalance: Number(acc.closingBalance ?? 0),
      }));

      if (accountFilter && accountFilter.length > 0) {
        return entries.filter((e) =>
          accountFilter.some((f) => e.accountNumber.startsWith(f))
        );
      }
      return entries;
    },

    async getHolidayPayData(year: number): Promise<HolidayPayData> {
      // Tripletex salary API does not expose holiday pay calculation directly.
      // We fetch payroll for the earning year and calculate based on Norwegian rules.
      const payroll = await this.getPayrollData({ year });

      const employees: HolidayPayEmployee[] = payroll.employees.map((emp) => {
        const basis = emp.grossPay;
        const rate = 0.102; // 10.2% standard, 12% for 5-week tariff agreements
        const calculated = Math.round(basis * rate * 100) / 100;
        return {
          employeeId: emp.employeeId,
          name: emp.name,
          holidayPayBasis: basis,
          rate: rate * 100,
          calculatedHolidayPay: calculated,
          paidHolidayPay: 0,
          remaining: calculated,
        };
      });

      return {
        year,
        employees,
        totalBasis: employees.reduce((s, e) => s + e.holidayPayBasis, 0),
        totalHolidayPay: employees.reduce((s, e) => s + e.calculatedHolidayPay, 0),
      };
    },
  };
}
