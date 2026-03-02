// ---------------------------------------------------------------------------
// Accounting System Adapter — felles interface og normaliserte datatyper
// ---------------------------------------------------------------------------

export class NotSupportedError extends Error {
  constructor(systemId: string, method: string) {
    super(`${method} is not supported by ${systemId}`);
    this.name = "NotSupportedError";
  }
}

/**
 * Felles interface for alle regnskapssystem-adaptere.
 * Hver metode returnerer normalisert data.
 * Metoder som systemet ikke støtter kaster NotSupportedError.
 */
export interface AccountingSystemAdapter {
  readonly systemId: string;
  readonly systemName: string;

  testConnection(): Promise<boolean>;

  getPayrollData(params: PeriodParams): Promise<PayrollData>;
  getVatTransactions(params: PeriodParams): Promise<VatTransaction[]>;
  getVatSummary(params: PeriodParams): Promise<VatSummary>;
  getAccountsReceivable(asOfDate: Date): Promise<ReceivableEntry[]>;
  getAccountsPayable(asOfDate: Date): Promise<PayableEntry[]>;
  getHolidayPayData(year: number): Promise<HolidayPayData>;
}

// ---------------------------------------------------------------------------
// Periode
// ---------------------------------------------------------------------------

export interface PeriodParams {
  year: number;
  month?: number;
  quarter?: number;
}

// ---------------------------------------------------------------------------
// Lønn
// ---------------------------------------------------------------------------

export interface PayrollData {
  period: PeriodParams;
  employees: PayrollEmployee[];
  totals: {
    grossPay: number;
    taxDeductions: number;
    employerContributions: number;
    netPay: number;
    pensionContributions: number;
    otherDeductions: number;
  };
}

export interface PayrollEmployee {
  employeeId: string;
  name: string;
  nationalId?: string;
  grossPay: number;
  taxDeductions: number;
  employerContributions: number;
  netPay: number;
  pensionContributions: number;
  benefits: PayrollBenefit[];
}

export interface PayrollBenefit {
  code: string;
  description: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// MVA
// ---------------------------------------------------------------------------

export interface VatTransaction {
  date: Date;
  voucherNumber: string;
  description: string;
  accountNumber: string;
  vatCode: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface VatSummary {
  period: PeriodParams;
  lines: VatSummaryLine[];
  totalBasis: number;
  totalVat: number;
}

export interface VatSummaryLine {
  vatCode: string;
  description: string;
  basis: number;
  rate: number;
  vatAmount: number;
}

// ---------------------------------------------------------------------------
// Reskontro
// ---------------------------------------------------------------------------

export interface ReceivableEntry {
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
}

export interface PayableEntry {
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Feriepenger
// ---------------------------------------------------------------------------

export interface HolidayPayData {
  year: number;
  employees: HolidayPayEmployee[];
  totalBasis: number;
  totalHolidayPay: number;
}

export interface HolidayPayEmployee {
  employeeId: string;
  name: string;
  holidayPayBasis: number;
  rate: number;
  calculatedHolidayPay: number;
  paidHolidayPay: number;
  remaining: number;
}
