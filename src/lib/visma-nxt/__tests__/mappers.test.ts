import { describe, it, expect } from "vitest";
import {
  mapCompany,
  mapAccount,
  mapPosting,
  mapReceivable,
  mapPayable,
} from "../mappers";
import type {
  VnxtCompany,
  VnxtAccount,
  VnxtTransaction,
  VnxtCustomerTransaction,
  VnxtSupplierTransaction,
} from "../types";

// ---------------------------------------------------------------------------
// mapCompany
// ---------------------------------------------------------------------------

describe("mapCompany", () => {
  it("maps a standard company", () => {
    const input: VnxtCompany = {
      companyNo: 123456,
      companyName: "Test AS",
      customerNo: 1,
    };
    const result = mapCompany(input);
    expect(result).toEqual({
      name: "Test AS",
      orgNumber: null,
      vismaNxtCompanyNo: 123456,
    });
  });

  it("handles null orgNumber", () => {
    const input: VnxtCompany = {
      companyNo: 1,
      companyName: "No Org",
      customerNo: 2,
    };
    expect(mapCompany(input).orgNumber).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapAccount
// ---------------------------------------------------------------------------

describe("mapAccount", () => {
  it("maps a ledger account", () => {
    const input: VnxtAccount = {
      accountNo: 3000,
      name: "Salgsinntekt",
      accountGroup: 3,
      accountSubType: null,
      taxCode: "3",
      isActive: true,
    };
    const result = mapAccount(input);
    expect(result).toEqual({
      accountNumber: "3000",
      name: "Salgsinntekt",
      accountType: "ledger",
      vismaNxtAccountNo: 3000,
    });
  });

  it("identifies bank accounts by number range (1900-1999)", () => {
    const input: VnxtAccount = {
      accountNo: 1920,
      name: "Bankkonto",
      accountGroup: 1,
      accountSubType: null,
      taxCode: null,
      isActive: true,
    };
    expect(mapAccount(input).accountType).toBe("bank");
  });

  it("classifies account 1899 as ledger", () => {
    const input: VnxtAccount = {
      accountNo: 1899,
      name: "Annen konto",
      accountGroup: 1,
      accountSubType: null,
      taxCode: null,
      isActive: true,
    };
    expect(mapAccount(input).accountType).toBe("ledger");
  });

  it("classifies account 2000 as ledger", () => {
    const input: VnxtAccount = {
      accountNo: 2000,
      name: "Egenkapital",
      accountGroup: 2,
      accountSubType: null,
      taxCode: null,
      isActive: true,
    };
    expect(mapAccount(input).accountType).toBe("ledger");
  });

  it("converts accountNo to string", () => {
    const input: VnxtAccount = {
      accountNo: 4000,
      name: "Varekost",
      accountGroup: 4,
      accountSubType: null,
      taxCode: null,
      isActive: true,
    };
    expect(mapAccount(input).accountNumber).toBe("4000");
  });
});

// ---------------------------------------------------------------------------
// mapPosting
// ---------------------------------------------------------------------------

describe("mapPosting", () => {
  const baseTransaction: VnxtTransaction = {
    accountNo: 3000,
    year: 2026,
    period: 1,
    postedAmountDomestic: 15000.5,
    voucherNo: 42,
    voucherDate: "2026-01-15",
    description: "Faktura #100",
    currencyCode: "NOK",
    departmentNo: null,
    projectNo: null,
    transactionNo: 99001,
  };

  it("maps a positive posting", () => {
    const result = mapPosting(baseTransaction);
    expect(result.setNumber).toBe(1);
    expect(result.accountNumber).toBe("3000");
    expect(result.amount).toBe("15000.50");
    expect(result.sign).toBe("+");
    expect(result.date1).toBe("2026-01-15");
    expect(result.bilag).toBe("42");
    expect(result.description).toBe("Faktura #100");
    expect(result.sourceType).toBe("visma_nxt");
    expect(result.externalId).toBe("vnxt:99001");
    expect(result.matchStatus).toBe("unmatched");
  });

  it("maps a negative posting", () => {
    const input = { ...baseTransaction, postedAmountDomestic: -500 };
    const result = mapPosting(input);
    expect(result.amount).toBe("-500.00");
    expect(result.sign).toBe("-");
  });

  it("uses year-period date when voucherDate is null", () => {
    const input = { ...baseTransaction, voucherDate: null };
    const result = mapPosting(input);
    expect(result.date1).toBe("2026-01-01");
  });

  it("generates fallback externalId when transactionNo is null", () => {
    const input = { ...baseTransaction, transactionNo: null };
    const result = mapPosting(input);
    expect(result.externalId).toBe("vnxt:3000-2026-1-42");
  });

  it("handles zero amount", () => {
    const input = { ...baseTransaction, postedAmountDomestic: 0 };
    const result = mapPosting(input);
    expect(result.amount).toBe("0.00");
    expect(result.sign).toBe("+");
  });

  it("applies enabledFields filter", () => {
    const result = mapPosting(baseTransaction, {
      description: false,
      bilag: false,
      faktura: true,
      reference: true,
      foreignAmount: true,
      accountNumber: true,
    });
    expect(result.description).toBeNull();
    expect(result.bilag).toBeNull();
    expect(result.accountNumber).toBe("3000");
  });

  it("handles null enabledFields", () => {
    const result = mapPosting(baseTransaction, null);
    expect(result.description).toBe("Faktura #100");
  });

  it("defaults currency to NOK when null", () => {
    const input = { ...baseTransaction, currencyCode: null };
    expect(mapPosting(input).currency).toBe("NOK");
  });
});

// ---------------------------------------------------------------------------
// mapReceivable
// ---------------------------------------------------------------------------

describe("mapReceivable", () => {
  it("maps a customer transaction to receivable", () => {
    const input: VnxtCustomerTransaction = {
      customerNo: 1001,
      customerName: "Kunde AS",
      documentNo: "INV-2026-001",
      postingDate: "2026-01-10",
      dueDate: "2026-02-10",
      originalAmount: 25000,
      remainingAmount: 25000,
      currencyCode: "NOK",
      transactionNo: 5001,
    };
    const result = mapReceivable(input);
    expect(result).toEqual({
      customerId: "1001",
      customerName: "Kunde AS",
      invoiceNumber: "INV-2026-001",
      invoiceDate: new Date("2026-01-10"),
      dueDate: new Date("2026-02-10"),
      originalAmount: 25000,
      remainingAmount: 25000,
      currency: "NOK",
    });
  });

  it("handles null customerName", () => {
    const input: VnxtCustomerTransaction = {
      customerNo: 42,
      customerName: null,
      documentNo: null,
      postingDate: null,
      dueDate: null,
      originalAmount: 100,
      remainingAmount: 50,
      currencyCode: null,
      transactionNo: null,
    };
    const result = mapReceivable(input);
    expect(result.customerName).toBe("Kunde 42");
    expect(result.currency).toBe("NOK");
  });
});

// ---------------------------------------------------------------------------
// mapPayable
// ---------------------------------------------------------------------------

describe("mapPayable", () => {
  it("maps a supplier transaction to payable", () => {
    const input: VnxtSupplierTransaction = {
      supplierNo: 2001,
      supplierName: "Leverandør AS",
      documentNo: "BILL-001",
      postingDate: "2026-01-05",
      dueDate: "2026-02-05",
      originalAmount: 10000,
      remainingAmount: 10000,
      currencyCode: "EUR",
      transactionNo: 6001,
    };
    const result = mapPayable(input);
    expect(result).toEqual({
      supplierId: "2001",
      supplierName: "Leverandør AS",
      invoiceNumber: "BILL-001",
      invoiceDate: new Date("2026-01-05"),
      dueDate: new Date("2026-02-05"),
      originalAmount: 10000,
      remainingAmount: 10000,
      currency: "EUR",
    });
  });

  it("handles null supplierName", () => {
    const input: VnxtSupplierTransaction = {
      supplierNo: 99,
      supplierName: null,
      documentNo: null,
      postingDate: null,
      dueDate: null,
      originalAmount: 0,
      remainingAmount: 0,
      currencyCode: null,
      transactionNo: null,
    };
    const result = mapPayable(input);
    expect(result.supplierName).toBe("Leverandør 99");
  });
});
