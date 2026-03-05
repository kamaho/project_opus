import type {
  VnxtCompany,
  VnxtAccount,
  VnxtTransaction,
  VnxtCustomerTransaction,
  VnxtSupplierTransaction,
} from "./types";
import type { EnabledFields } from "@/lib/tripletex/mappers";
import type { MappedTransaction } from "@/lib/tripletex/mappers";

// ---------------------------------------------------------------------------
// Visma NXT → Revizo mappers
// Produces identical output shapes as the Tripletex mappers.
// ---------------------------------------------------------------------------

// --- Company ---

export interface MappedVnxtCompany {
  name: string;
  orgNumber: string | null;
  vismaNxtCompanyNo: number;
}

export function mapCompany(c: VnxtCompany): MappedVnxtCompany {
  return {
    name: c.companyName,
    orgNumber: null,
    vismaNxtCompanyNo: c.companyNo,
  };
}

// --- Account ---

export interface MappedVnxtAccount {
  accountNumber: string;
  name: string;
  accountType: "ledger" | "bank";
  vismaNxtAccountNo: number;
}

/**
 * Map a Visma NXT account to Revizo's normalized format.
 * Bank accounts are identified by Norwegian account number ranges (1900-1999).
 */
export function mapAccount(a: VnxtAccount): MappedVnxtAccount {
  return {
    accountNumber: String(a.accountNo),
    name: a.name,
    accountType: isBankAccount(a.accountNo) ? "bank" : "ledger",
    vismaNxtAccountNo: a.accountNo,
  };
}

function isBankAccount(accountNo: number): boolean {
  return accountNo >= 1900 && accountNo <= 1999;
}

// --- GL Transaction → MappedTransaction (Set 1 = hovedbok) ---

function applyFieldFilter(
  tx: MappedTransaction,
  fields: EnabledFields | null | undefined
): MappedTransaction {
  if (!fields) return tx;
  return {
    ...tx,
    description: fields.description !== false ? tx.description : null,
    bilag: fields.bilag !== false ? tx.bilag : null,
    faktura: fields.faktura !== false ? tx.faktura : null,
    reference: fields.reference !== false ? tx.reference : null,
    foreignAmount: fields.foreignAmount !== false ? tx.foreignAmount : null,
    accountNumber: fields.accountNumber !== false ? tx.accountNumber : null,
  };
}

export function mapPosting(
  t: VnxtTransaction,
  enabledFields?: EnabledFields | null
): MappedTransaction {
  const amount = t.postedAmountDomestic ?? 0;
  const tx: MappedTransaction = {
    setNumber: 1,
    accountNumber: String(t.accountNo),
    amount: amount.toFixed(2),
    foreignAmount: null,
    currency: t.currencyCode ?? "NOK",
    date1: t.voucherDate ?? `${t.year}-${String(t.period).padStart(2, "0")}-01`,
    description: t.description ?? null,
    bilag: t.voucherNo != null ? String(t.voucherNo) : null,
    faktura: null,
    reference: null,
    sign: amount >= 0 ? "+" : "-",
    sourceType: "visma_nxt" as MappedTransaction["sourceType"],
    externalId: `vnxt:${t.transactionNo ?? `${t.accountNo}-${t.year}-${t.period}-${t.voucherNo}`}`,
    matchStatus: "unmatched",
  };
  return applyFieldFilter(tx, enabledFields);
}

// --- Customer Transaction → ReceivableEntry (from accounting adapter) ---

export interface MappedReceivable {
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
}

export function mapReceivable(t: VnxtCustomerTransaction): MappedReceivable {
  return {
    customerId: String(t.customerNo),
    customerName: t.customerName ?? `Kunde ${t.customerNo}`,
    invoiceNumber: t.documentNo ?? String(t.transactionNo ?? t.customerNo),
    invoiceDate: t.postingDate ? new Date(t.postingDate) : new Date(),
    dueDate: t.dueDate ? new Date(t.dueDate) : new Date(),
    originalAmount: t.originalAmount ?? 0,
    remainingAmount: t.remainingAmount ?? 0,
    currency: t.currencyCode ?? "NOK",
  };
}

// --- Supplier Transaction → PayableEntry (from accounting adapter) ---

export interface MappedPayable {
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
}

export function mapPayable(t: VnxtSupplierTransaction): MappedPayable {
  return {
    supplierId: String(t.supplierNo),
    supplierName: t.supplierName ?? `Leverandør ${t.supplierNo}`,
    invoiceNumber: t.documentNo ?? String(t.transactionNo ?? t.supplierNo),
    invoiceDate: t.postingDate ? new Date(t.postingDate) : new Date(),
    dueDate: t.dueDate ? new Date(t.dueDate) : new Date(),
    originalAmount: t.originalAmount ?? 0,
    remainingAmount: t.remainingAmount ?? 0,
    currency: t.currencyCode ?? "NOK",
  };
}
