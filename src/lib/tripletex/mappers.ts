import type { TxPosting, TxBankTransaction, TxCompany, TxAccount } from "./types";

// ---------------------------------------------------------------------------
// Enabled-fields type (which optional fields to include in sync)
// ---------------------------------------------------------------------------

export type EnabledFields = Record<string, boolean>;

export const DEFAULT_ENABLED_FIELDS: EnabledFields = {
  description: true,
  bilag: true,
  faktura: false,
  reference: true,
  foreignAmount: false,
  accountNumber: true,
};

export const FIELD_LABELS: Record<string, string> = {
  description: "Beskrivelse",
  bilag: "Bilagsnummer",
  faktura: "Fakturanummer",
  reference: "Referanse",
  foreignAmount: "Valutabeløp",
  accountNumber: "Kontonummer",
};

// ---------------------------------------------------------------------------
// Tripletex posting → Revizo transaction (Set 1 = hovedbok)
// ---------------------------------------------------------------------------

export interface MappedTransaction {
  setNumber: 1 | 2;
  accountNumber: string | null;
  amount: string;
  foreignAmount: string | null;
  currency: string;
  date1: string;
  description: string | null;
  bilag: string | null;
  faktura: string | null;
  reference: string | null;
  sign: "+" | "-";
  sourceType: "tripletex";
  externalId: string;
  matchStatus: "unmatched";
}

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
  p: TxPosting,
  enabledFields?: EnabledFields | null
): MappedTransaction {
  const amount = p.amount ?? 0;
  const tx: MappedTransaction = {
    setNumber: 1,
    accountNumber: p.account?.number?.toString() ?? null,
    amount: amount.toFixed(2),
    foreignAmount: p.amountCurrency != null ? p.amountCurrency.toFixed(2) : null,
    currency: "NOK",
    date1: p.date,
    description: p.description ?? null,
    bilag: p.voucher?.number?.toString() ?? null,
    faktura: p.invoice?.invoiceNumber?.toString() ?? null,
    reference: null,
    sign: amount >= 0 ? "+" : "-",
    sourceType: "tripletex",
    externalId: `posting:${p.id}`,
    matchStatus: "unmatched",
  };
  return applyFieldFilter(tx, enabledFields);
}

// ---------------------------------------------------------------------------
// Tripletex bank transaction → Revizo transaction (Set 2 = bank)
// ---------------------------------------------------------------------------

export function mapBankTransaction(
  bt: TxBankTransaction,
  enabledFields?: EnabledFields | null
): MappedTransaction {
  const amount = bt.amount ?? 0;
  const tx: MappedTransaction = {
    setNumber: 2,
    accountNumber: bt.account?.number?.toString() ?? null,
    amount: amount.toFixed(2),
    foreignAmount: null,
    currency: "NOK",
    date1: bt.transactionDate,
    description: bt.description ?? null,
    bilag: null,
    faktura: null,
    reference: bt.archiveReference ?? null,
    sign: amount >= 0 ? "+" : "-",
    sourceType: "tripletex",
    externalId: `bank:${bt.id}`,
    matchStatus: "unmatched",
  };
  return applyFieldFilter(tx, enabledFields);
}

// ---------------------------------------------------------------------------
// Tripletex company → Revizo company partial
// ---------------------------------------------------------------------------

export interface MappedCompany {
  name: string;
  orgNumber: string | null;
  tripletexCompanyId: number;
}

export function mapCompany(c: TxCompany): MappedCompany {
  return {
    name: c.displayName || c.name,
    orgNumber: c.organizationNumber || null,
    tripletexCompanyId: c.id,
  };
}

// ---------------------------------------------------------------------------
// Tripletex account → Revizo account partial
// ---------------------------------------------------------------------------

export interface MappedAccount {
  accountNumber: string;
  name: string;
  accountType: "ledger" | "bank";
  tripletexAccountId: number;
}

export function mapAccount(a: TxAccount): MappedAccount {
  return {
    accountNumber: a.number.toString(),
    name: a.name,
    accountType: a.isBankAccount ? "bank" : "ledger",
    tripletexAccountId: a.id,
  };
}
