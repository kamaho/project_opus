export type {
  AccountingSystemAdapter,
  PeriodParams,
  PayrollData,
  PayrollEmployee,
  PayrollBenefit,
  VatTransaction,
  VatSummary,
  VatSummaryLine,
  ReceivableEntry,
  PayableEntry,
  HolidayPayData,
  HolidayPayEmployee,
} from "./types";

export { NotSupportedError } from "./types";
export { getAdapter, getSupportedSystems } from "./registry";
export type { SystemCredentials, SupportedSystem } from "./registry";
