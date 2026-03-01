// ---------------------------------------------------------------------------
// Tripletex API response types (subset relevant for sync)
// ---------------------------------------------------------------------------

export interface TxRef {
  id: number;
  url: string;
}

export interface TxCompany {
  id: number;
  name: string;
  displayName?: string;
  organizationNumber?: string;
  email?: string;
  type?: string;
  currency?: TxRef;
}

export interface TxAccount {
  id: number;
  number: number;
  name: string;
  description?: string;
  type?: string; // ASSETS, LIABILITIES, EQUITY, REVENUE, EXPENSE, …
  ledgerType?: string; // GENERAL, CUSTOMER, SUPPLIER, EMPLOYEE
  isBankAccount?: boolean;
  bankAccountNumber?: string;
  currency?: TxRef | null;
  isInactive?: boolean;
  requireReconciliation?: boolean;
  displayName?: string;
  saftCode?: string;
}

export interface TxPosting {
  id: number;
  date: string; // YYYY-MM-DD
  description?: string;
  amount: number;
  amountCurrency?: number;
  amountGross?: number;
  currency?: TxRef;
  account?: TxRef & { number?: number };
  voucher?: TxRef & { number?: number; date?: string };
  invoice?: TxRef & { invoiceNumber?: number };
  row?: number;
  type?: string;
  systemGenerated?: boolean;
  project?: TxRef | null;
  department?: TxRef | null;
  vatType?: TxRef | null;
}

export interface TxBankTransaction {
  id: number;
  transactionDate: string; // YYYY-MM-DD
  description?: string;
  amount: number;
  archiveReference?: string;
  bankStatement?: TxRef;
  account?: TxRef & { number?: number };
}

export interface TxBalance {
  account?: TxRef & { number?: number };
  balanceIn?: number;
  balanceOut?: number;
  balanceChange?: number;
}
