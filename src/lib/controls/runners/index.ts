import { registerRunner } from "../runner";
import { accountsReceivableRunner } from "./accounts-receivable";
import { accountsPayableRunner } from "./accounts-payable";
import { payrollRunner } from "./payroll";
import { periodizationRunner } from "./periodization";

export function registerAllRunners(): void {
  registerRunner(accountsReceivableRunner);
  registerRunner(accountsPayableRunner);
  registerRunner(payrollRunner);
  registerRunner(periodizationRunner);
}

registerAllRunners();
