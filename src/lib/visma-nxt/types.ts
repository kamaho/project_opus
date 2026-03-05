// ---------------------------------------------------------------------------
// Visma Business NXT — GraphQL response types
// Internal to the Visma NXT adapter; mapped to Revizo types via mappers.ts
// ---------------------------------------------------------------------------

// --- Company ---

export interface VnxtCompanyRaw {
  name: string;
  vismaNetCompanyId: number;
  vismaNetCustomerId: number;
}

export interface VnxtCompany {
  companyNo: number;
  companyName: string;
  customerNo: number;
}

// --- General Ledger Account ---

export interface VnxtAccount {
  accountNo: number;
  name: string;
  accountGroup: number | null;
  accountSubType: number | null;
  taxCode: string | null;
  isActive: boolean;
}

// --- General Ledger Transaction ---

export interface VnxtTransaction {
  accountNo: number;
  year: number;
  period: number;
  postedAmountDomestic: number;
  voucherNo: number | null;
  voucherDate: string | null;
  description: string | null;
  currencyCode: string | null;
  departmentNo: number | null;
  projectNo: number | null;
  transactionNo: number | null;
}

// --- Customer Transaction (Accounts Receivable) ---

export interface VnxtCustomerTransaction {
  customerNo: number;
  customerName: string | null;
  documentNo: string | null;
  postingDate: string | null;
  dueDate: string | null;
  originalAmount: number;
  remainingAmount: number;
  currencyCode: string | null;
  transactionNo: number | null;
}

// --- Supplier Transaction (Accounts Payable) ---

export interface VnxtSupplierTransaction {
  supplierNo: number;
  supplierName: string | null;
  documentNo: string | null;
  postingDate: string | null;
  dueDate: string | null;
  originalAmount: number;
  remainingAmount: number;
  currencyCode: string | null;
  transactionNo: number | null;
}

// --- Aggregated Balance (from groupBy queries) ---

export interface VnxtAggregatedBalance {
  accountNo: number;
  aggregates: {
    sum: {
      postedAmountDomestic: number;
    };
  };
}

// --- Pagination (Relay-style, but items instead of edges) ---

export interface VnxtPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface VnxtPaginatedResponse<T> {
  totalCount: number;
  pageInfo: VnxtPageInfo;
  items: T[];
}

// --- GraphQL Response Wrapper ---

export interface VnxtGraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: { code: string; [key: string]: unknown };
}

export interface VnxtGraphQLResponse<T> {
  data: T | null;
  errors?: VnxtGraphQLError[];
}

// --- Webhook Payload ---

export interface VnxtWebhookPayload {
  tableIdentifier: string;
  customerNo: number;
  companyNo: number;
  event: "INSERT" | "UPDATE" | "DELETE";
  primaryKeys: Array<Record<string, unknown>>;
  timestamp: string;
  changedByUser: string | null;
  changedColumns?: Array<Record<string, unknown>>;
}

// --- Auth ---

export interface VnxtTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}
