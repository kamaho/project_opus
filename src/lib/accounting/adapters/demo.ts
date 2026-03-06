import type {
  AccountingSystemAdapter,
  PayrollData,
  PayrollEmployee,
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
import type { SystemCredentials } from "../registry";

// ---------------------------------------------------------------------------
// Date helpers — offsets relative to "today" for realistic aging
// ---------------------------------------------------------------------------

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(days: number): Date {
  return daysAgo(-days);
}

// ---------------------------------------------------------------------------
// Static demo data — Norwegian companies and realistic amounts
// ---------------------------------------------------------------------------

const DEMO_CUSTOMERS = [
  { id: "10007", name: "Nordvik Bygg AS" },
  { id: "10012", name: "Berg Consulting ENK" },
  { id: "10019", name: "Fjord Eiendom AS" },
  { id: "10024", name: "Kystmarin Havbruk AS" },
  { id: "10031", name: "Solheim Transport AS" },
];

const DEMO_SUPPLIERS = [
  { id: "20001", name: "Elektro Sør AS" },
  { id: "20008", name: "Kontorservice Norge AS" },
  { id: "20015", name: "Bygg & Anlegg Vestland AS" },
  { id: "20022", name: "IKT Drift Norge AS" },
];

const DEMO_EMPLOYEES: Array<{
  id: string;
  name: string;
  gross: number;
  taxPct: number;
  pension: number;
}> = [
  { id: "E001", name: "Kari Nordmann", gross: 65000, taxPct: 0.33, pension: 1300 },
  { id: "E002", name: "Ola Hansen", gross: 52000, taxPct: 0.30, pension: 1040 },
  { id: "E003", name: "Ingrid Solberg", gross: 85000, taxPct: 0.35, pension: 1700 },
  { id: "E004", name: "Lars Bakken", gross: 47000, taxPct: 0.29, pension: 940 },
  { id: "E005", name: "Marte Sæther", gross: 58000, taxPct: 0.31, pension: 1160 },
  { id: "E006", name: "Erik Lunde", gross: 72000, taxPct: 0.34, pension: 1440 },
];

const AGA_RATE = 0.141;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDemoAdapter(
  _creds: SystemCredentials,
): AccountingSystemAdapter {
  return {
    systemId: "demo",
    systemName: "Demo (testdata)",

    async testConnection(): Promise<boolean> {
      return true;
    },

    async getAccountsReceivable(_asOfDate: Date): Promise<ReceivableEntry[]> {
      const entries: ReceivableEntry[] = [
        // Nordvik Bygg — mix of current and overdue
        inv(DEMO_CUSTOMERS[0], "000062", daysAgo(120), daysAgo(95), 45000, 13431.25),
        inv(DEMO_CUSTOMERS[0], "000063", daysAgo(100), daysAgo(75), 45000, 13431.25),
        inv(DEMO_CUSTOMERS[0], "000071", daysAgo(55), daysAgo(30), 28500, 28500),
        inv(DEMO_CUSTOMERS[0], "000078", daysAgo(20), daysAgo(5), 20475, 20475),
        // Kreditnota
        inv(DEMO_CUSTOMERS[0], "KN-004", daysAgo(40), daysAgo(40), -9375, -9375),

        // Berg Consulting — mostly current
        inv(DEMO_CUSTOMERS[1], "000064", daysAgo(15), daysFromNow(15), 18750, 18750),
        inv(DEMO_CUSTOMERS[1], "000070", daysAgo(10), daysFromNow(20), 12500, 12500),
        inv(DEMO_CUSTOMERS[1], "000075", daysAgo(45), daysAgo(20), 32000, 32000),

        // Fjord Eiendom — heavy overdue
        inv(DEMO_CUSTOMERS[2], "000065", daysAgo(180), daysAgo(150), 62500, 62500),
        inv(DEMO_CUSTOMERS[2], "000066", daysAgo(130), daysAgo(100), 38750, 38750),
        inv(DEMO_CUSTOMERS[2], "000077", daysAgo(60), daysAgo(35), 15200, 15200),

        // Kystmarin Havbruk — single large outstanding
        inv(DEMO_CUSTOMERS[3], "000067", daysAgo(200), daysAgo(170), 87500, 87500),
        inv(DEMO_CUSTOMERS[3], "000079", daysAgo(25), daysFromNow(5), 24300, 24300),

        // Solheim Transport — few items, some current
        inv(DEMO_CUSTOMERS[4], "000068", daysAgo(40), daysAgo(15), 5700, 5700),
        inv(DEMO_CUSTOMERS[4], "000072", daysAgo(8), daysFromNow(22), 14800, 14800),
        inv(DEMO_CUSTOMERS[4], "000080", daysAgo(95), daysAgo(65), 26650, 26650),
      ];

      return entries;
    },

    async getAccountsPayable(_asOfDate: Date): Promise<PayableEntry[]> {
      const entries: PayableEntry[] = [
        // Elektro Sør
        sup(DEMO_SUPPLIERS[0], "F-2024-1042", daysAgo(110), daysAgo(80), 34500, 34500),
        sup(DEMO_SUPPLIERS[0], "F-2024-1089", daysAgo(50), daysAgo(20), 18250, 18250),
        sup(DEMO_SUPPLIERS[0], "F-2025-0012", daysAgo(12), daysFromNow(18), 22100, 22100),

        // Kontorservice Norge
        sup(DEMO_SUPPLIERS[1], "KS-90234", daysAgo(65), daysAgo(35), 8900, 8900),
        sup(DEMO_SUPPLIERS[1], "KS-90301", daysAgo(30), daysAgo(0), 12450, 12450),
        sup(DEMO_SUPPLIERS[1], "KS-90345", daysAgo(5), daysFromNow(25), 6800, 6800),

        // Bygg & Anlegg Vestland
        sup(DEMO_SUPPLIERS[2], "BAV-5501", daysAgo(150), daysAgo(120), 45000, 45000),
        sup(DEMO_SUPPLIERS[2], "BAV-5589", daysAgo(85), daysAgo(55), 28750, 28750),
        sup(DEMO_SUPPLIERS[2], "BAV-5612", daysAgo(20), daysFromNow(10), 15500, 15500),

        // IKT Drift Norge
        sup(DEMO_SUPPLIERS[3], "IKT-7801", daysAgo(35), daysAgo(5), 9200, 9200),
        sup(DEMO_SUPPLIERS[3], "IKT-7845", daysAgo(10), daysFromNow(20), 4500, 4500),
        sup(DEMO_SUPPLIERS[3], "IKT-7802", daysAgo(100), daysAgo(70), 16300, 16300),
      ];

      return entries;
    },

    async getPayrollData(params: PeriodParams): Promise<PayrollData> {
      const employees: PayrollEmployee[] = DEMO_EMPLOYEES.map((e) => {
        const tax = Math.round(e.gross * e.taxPct);
        const aga = Math.round(e.gross * AGA_RATE);
        const net = e.gross - tax - e.pension;
        return {
          employeeId: e.id,
          name: e.name,
          grossPay: e.gross,
          taxDeductions: tax,
          employerContributions: aga,
          netPay: net,
          pensionContributions: e.pension,
          benefits: [
            { code: "fastlonn", description: "Fastlønn", amount: e.gross },
          ],
        };
      });

      const totals = employees.reduce(
        (acc, emp) => ({
          grossPay: acc.grossPay + emp.grossPay,
          taxDeductions: acc.taxDeductions + emp.taxDeductions,
          employerContributions: acc.employerContributions + emp.employerContributions,
          netPay: acc.netPay + emp.netPay,
          pensionContributions: acc.pensionContributions + emp.pensionContributions,
          otherDeductions: 0,
        }),
        { grossPay: 0, taxDeductions: 0, employerContributions: 0, netPay: 0, pensionContributions: 0, otherDeductions: 0 },
      );

      return { period: params, employees, totals };
    },

    async getVatTransactions(params: PeriodParams): Promise<VatTransaction[]> {
      const baseDate = params.month
        ? new Date(params.year, params.month - 1, 15)
        : new Date(params.year, 0, 15);

      const txs: VatTransaction[] = [
        vatTx(baseDate, "V-1001", "Varesalg innenlands", "3000", "3", 450000, 112500),
        vatTx(baseDate, "V-1002", "Varesalg innenlands", "3010", "3", 125000, 31250),
        vatTx(baseDate, "V-1003", "Tjenestesalg innenlands", "3100", "3", 85000, 21250),
        vatTx(addDays(baseDate, 2), "V-1010", "Varekjøp innenlands", "4000", "1", -280000, -70000),
        vatTx(addDays(baseDate, 2), "V-1011", "Varekjøp innenlands", "4010", "1", -95000, -23750),
        vatTx(addDays(baseDate, 3), "V-1020", "Eksportsalg", "3200", "6", 210000, 0),
        vatTx(addDays(baseDate, 3), "V-1021", "Eksportsalg", "3210", "6", 65000, 0),
        vatTx(addDays(baseDate, 5), "V-1030", "Matvarer 15%", "3050", "31", 38000, 5700),
        vatTx(addDays(baseDate, 5), "V-1031", "Matvarer 15%", "3051", "31", 22000, 3300),
        vatTx(addDays(baseDate, 7), "V-1040", "Persontransport 12%", "3300", "33", 45000, 5400),
        vatTx(addDays(baseDate, 7), "V-1041", "Persontransport 12%", "3310", "33", 18000, 2160),
        vatTx(addDays(baseDate, 8), "V-1050", "Kjøp med fradrag", "4300", "1", -42000, -10500),
        vatTx(addDays(baseDate, 10), "V-1060", "Kontorrekvisita", "6800", "1", -8500, -2125),
        vatTx(addDays(baseDate, 10), "V-1061", "IT-utstyr", "6850", "1", -15000, -3750),
        vatTx(addDays(baseDate, 12), "V-1070", "Husleie (fritatt)", "6300", "5", -35000, 0),
        vatTx(addDays(baseDate, 14), "V-1080", "Reverse charge import", "4500", "81", -68000, -17000),
        vatTx(addDays(baseDate, 14), "V-1081", "Reverse charge utg. MVA", "2711", "81", 68000, 17000),
        vatTx(addDays(baseDate, 15), "V-1090", "Korreksjon varesalg", "3000", "3", -12000, -3000),
        vatTx(addDays(baseDate, 18), "V-1100", "Konsulenthonorar", "6700", "1", -28000, -7000),
        vatTx(addDays(baseDate, 20), "V-1110", "Salg kiosk 25%", "3020", "3", 9500, 2375),
        vatTx(addDays(baseDate, 22), "V-1120", "Reisekostnader", "7100", "1", -4200, -1050),
      ];

      return txs;
    },

    async getVatSummary(params: PeriodParams): Promise<VatSummary> {
      const transactions = await this.getVatTransactions(params);

      const codeMap = new Map<string, VatSummaryLine>();

      const codeDescriptions: Record<string, { desc: string; rate: number }> = {
        "1": { desc: "Inngående MVA, alminnelig sats", rate: 25 },
        "3": { desc: "Utgående MVA, alminnelig sats", rate: 25 },
        "5": { desc: "Fritatt for MVA", rate: 0 },
        "6": { desc: "Eksport, nullsats", rate: 0 },
        "31": { desc: "Utgående MVA, redusert sats matvarer", rate: 15 },
        "33": { desc: "Utgående MVA, redusert sats persontransport", rate: 12 },
        "81": { desc: "Reverse charge, innførsel av tjenester", rate: 25 },
      };

      for (const tx of transactions) {
        const existing = codeMap.get(tx.vatCode);
        if (existing) {
          existing.basis += tx.netAmount;
          existing.vatAmount += tx.vatAmount;
        } else {
          const info = codeDescriptions[tx.vatCode] ?? { desc: `MVA-kode ${tx.vatCode}`, rate: 0 };
          codeMap.set(tx.vatCode, {
            vatCode: tx.vatCode,
            description: info.desc,
            basis: tx.netAmount,
            rate: info.rate,
            vatAmount: tx.vatAmount,
          });
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

    async getTrialBalance(_params: PeriodParams, _accountFilter?: string[]): Promise<TrialBalanceEntry[]> {
      const accounts: TrialBalanceEntry[] = [
        { accountNumber: "1500", accountName: "Kundefordringer", openingBalance: 245000, periodDebit: 380000, periodCredit: 350000, closingBalance: 275000 },
        { accountNumber: "1700", accountName: "Forskuddsbetalte kostnader", openingBalance: 18000, periodDebit: 0, periodCredit: 0, closingBalance: 18000 },
        { accountNumber: "1920", accountName: "Bankinnskudd", openingBalance: 520000, periodDebit: 890000, periodCredit: 870000, closingBalance: 540000 },
        { accountNumber: "2400", accountName: "Leverandørgjeld", openingBalance: -185000, periodDebit: 310000, periodCredit: 340000, closingBalance: -215000 },
        { accountNumber: "2900", accountName: "Annen kortsiktig gjeld", openingBalance: -45000, periodDebit: 0, periodCredit: 0, closingBalance: -45000 },
        { accountNumber: "2960", accountName: "Påløpt feriepenger", openingBalance: -128000, periodDebit: 0, periodCredit: 12000, closingBalance: -140000 },
        { accountNumber: "3000", accountName: "Salgsinntekt", openingBalance: 0, periodDebit: 0, periodCredit: 380000, closingBalance: -380000 },
        { accountNumber: "5000", accountName: "Lønn", openingBalance: 0, periodDebit: 285000, periodCredit: 0, closingBalance: 285000 },
        { accountNumber: "6300", accountName: "Leie lokale", openingBalance: 0, periodDebit: 25000, periodCredit: 0, closingBalance: 25000 },
      ];
      if (_accountFilter && _accountFilter.length > 0) {
        return accounts.filter((a) =>
          _accountFilter.some((f) => a.accountNumber.startsWith(f))
        );
      }
      return accounts;
    },

    async getHolidayPayData(year: number): Promise<HolidayPayData> {
      const employees: HolidayPayEmployee[] = DEMO_EMPLOYEES.map((e) => {
        const annualBasis = e.gross * 12;
        const isOver60 = e.id === "E003";
        const rate = isOver60 ? 0.12 : 0.102;
        const calculated = Math.round(annualBasis * rate * 100) / 100;
        const paid = Math.round(calculated * 0.4);
        return {
          employeeId: e.id,
          name: e.name,
          holidayPayBasis: annualBasis,
          rate: rate * 100,
          calculatedHolidayPay: calculated,
          paidHolidayPay: paid,
          remaining: calculated - paid,
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

// ---------------------------------------------------------------------------
// Helpers for building demo entries
// ---------------------------------------------------------------------------

function inv(
  customer: { id: string; name: string },
  invoiceNumber: string,
  invoiceDate: Date,
  dueDate: Date,
  originalAmount: number,
  remainingAmount: number,
): ReceivableEntry {
  return {
    customerId: customer.id,
    customerName: customer.name,
    invoiceNumber,
    invoiceDate,
    dueDate,
    originalAmount,
    remainingAmount,
    currency: "NOK",
  };
}

function sup(
  supplier: { id: string; name: string },
  invoiceNumber: string,
  invoiceDate: Date,
  dueDate: Date,
  originalAmount: number,
  remainingAmount: number,
): PayableEntry {
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    invoiceNumber,
    invoiceDate,
    dueDate,
    originalAmount,
    remainingAmount,
    currency: "NOK",
  };
}

function vatTx(
  date: Date,
  voucherNumber: string,
  description: string,
  accountNumber: string,
  vatCode: string,
  netAmount: number,
  vatAmount: number,
): VatTransaction {
  return {
    date,
    voucherNumber,
    description,
    accountNumber,
    vatCode,
    netAmount,
    vatAmount,
    grossAmount: netAmount + vatAmount,
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
