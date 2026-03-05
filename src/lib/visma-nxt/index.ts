export {
  getAuthorizationUrl,
  exchangeCode,
  refreshAccessToken,
  getValidToken,
  saveConnection,
  getConnection,
  getCompanyNo,
  setCompanyNo,
  disconnect,
} from "./auth";

export { query, companyQuery, fetchAllPages, VismaNxtError } from "./client";

export {
  mapCompany,
  mapAccount,
  mapPosting,
  mapReceivable,
  mapPayable,
} from "./mappers";

export {
  getCompanies,
  syncCompany,
  syncAccountList,
  syncBalancesForAccounts,
  syncPostings,
  syncTransactionsForAccount,
  runFullSync,
} from "./sync";

export type {
  MappedVnxtCompany,
  MappedVnxtAccount,
  MappedReceivable,
  MappedPayable,
} from "./mappers";

export type {
  VnxtCompany,
  VnxtAccount,
  VnxtTransaction,
  VnxtCustomerTransaction,
  VnxtSupplierTransaction,
  VnxtAggregatedBalance,
  VnxtPageInfo,
  VnxtPaginatedResponse,
  VnxtGraphQLResponse,
  VnxtGraphQLError,
  VnxtWebhookPayload,
  VnxtTokenResponse,
} from "./types";
