// ---------------------------------------------------------------------------
// Visma Business NXT — GraphQL Query Strings
//
// Table/field names verified against docs.vismasoftware.no/businessnxtapi.
// If field names fail at runtime, use INTROSPECT_TABLES to discover correct names.
// ---------------------------------------------------------------------------

/**
 * List companies accessible to the authenticated user.
 * Does NOT use useCompany — this is a top-level query.
 */
export const GET_COMPANIES = `
  query GetCompanies {
    availableCompanies {
      totalCount
      items {
        name
        vismaNetCompanyId
        vismaNetCustomerId
      }
    }
  }
`;

/**
 * Fetch chart of accounts for a company.
 * Wrapped in useCompany by companyQuery().
 */
export const GET_ACCOUNTS = `
  generalLedgerAccount(
    first: $first
    after: $after
  ) {
    totalCount
    pageInfo { hasNextPage endCursor }
    items {
      accountNo
      name
      accountGroup
      accountSubType
      taxCode
    }
  }
`;

/**
 * Fetch general ledger transactions with filters and pagination.
 * Requires useCompany wrapping.
 */
export const GET_TRANSACTIONS = `
  query GetTransactions(
    $companyNo: Int!
    $first: Int
    $after: String
    $yearFrom: Short
    $yearTo: Short
    $periodFrom: Short
    $periodTo: Short
    $accountNo: Int
  ) {
    useCompany(no: $companyNo) {
      generalLedgerTransaction(
        filter: {
          _and: [
            { year: { _gte: $yearFrom, _lte: $yearTo } }
            { period: { _gte: $periodFrom, _lte: $periodTo } }
            { accountNo: { _eq: $accountNo } }
          ]
        }
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        items {
          transactionNo
          accountNo
          year
          period
          postedAmountDomestic
          voucherNo
          voucherDate
          description
          currencyCode
          departmentNo
          projectNo
        }
      }
    }
  }
`;

/**
 * Fetch all transactions for a company within a year (no account filter).
 * Used by sync to pull incremental data.
 */
export const GET_TRANSACTIONS_BY_YEAR = `
  query GetTransactionsByYear(
    $companyNo: Int!
    $year: Short!
    $first: Int
    $after: String
  ) {
    useCompany(no: $companyNo) {
      generalLedgerTransaction(
        filter: { year: { _eq: $year } }
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        items {
          transactionNo
          accountNo
          year
          period
          postedAmountDomestic
          voucherNo
          voucherDate
          description
          currencyCode
          departmentNo
          projectNo
        }
      }
    }
  }
`;

/**
 * Compute trial balance using groupBy aggregation.
 * Always filter by year to avoid 30s timeout on large datasets.
 */
export const GET_TRIAL_BALANCE = `
  query GetTrialBalance(
    $companyNo: Int!
    $year: Short!
    $periodFrom: Short
    $periodTo: Short
  ) {
    useCompany(no: $companyNo) {
      generalLedgerTransaction(
        filter: {
          _and: [
            { year: { _eq: $year } }
            { period: { _gte: $periodFrom, _lte: $periodTo } }
          ]
        }
        groupBy: [{ accountNo: DEFAULT }]
      ) {
        items {
          accountNo
          aggregates {
            sum { postedAmountDomestic }
          }
        }
      }
    }
  }
`;

/**
 * Fetch open customer transactions (accounts receivable).
 */
export const GET_CUSTOMER_TRANSACTIONS = `
  query GetCustomerTransactions(
    $companyNo: Int!
    $first: Int
    $after: String
  ) {
    useCompany(no: $companyNo) {
      customerTransaction(
        filter: { remainingAmount: { _not_eq: 0 } }
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        items {
          transactionNo
          customerNo
          documentNo
          postingDate
          dueDate
          originalAmount
          remainingAmount
          currencyCode
        }
      }
    }
  }
`;

/**
 * Fetch open supplier transactions (accounts payable).
 */
export const GET_SUPPLIER_TRANSACTIONS = `
  query GetSupplierTransactions(
    $companyNo: Int!
    $first: Int
    $after: String
  ) {
    useCompany(no: $companyNo) {
      supplierTransaction(
        filter: { remainingAmount: { _not_eq: 0 } }
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        items {
          transactionNo
          supplierNo
          documentNo
          postingDate
          dueDate
          originalAmount
          remainingAmount
          currencyCode
        }
      }
    }
  }
`;

/**
 * Discover available tables via useModel introspection.
 * Use this to verify table identifiers at runtime.
 */
export const INTROSPECT_TABLES = `
  query IntrospectTables {
    useModel(lang: ENGLISH) {
      tables {
        tableNo
        identifier
        name
        databaseType
      }
    }
  }
`;

/**
 * Fetch VAT-related transactions for control reports.
 * Filters on taxCode being set (non-null).
 */
export const GET_VAT_TRANSACTIONS = `
  query GetVatTransactions(
    $companyNo: Int!
    $year: Short!
    $periodFrom: Short
    $periodTo: Short
    $first: Int
    $after: String
  ) {
    useCompany(no: $companyNo) {
      generalLedgerTransaction(
        filter: {
          _and: [
            { year: { _eq: $year } }
            { period: { _gte: $periodFrom, _lte: $periodTo } }
            { taxCode: { _is_not_null: true } }
          ]
        }
        first: $first
        after: $after
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        items {
          transactionNo
          accountNo
          year
          period
          postedAmountDomestic
          voucherNo
          voucherDate
          description
          taxCode
        }
      }
    }
  }
`;
