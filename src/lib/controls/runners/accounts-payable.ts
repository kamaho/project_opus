import type { ControlContext, ControlRunner } from "../runner";
import type { ControlResult } from "../types";
import { runAccountsPayableControl } from "../engines/accounts-payable";

function resolveAsOfDate(period: ControlContext["period"]): Date {
  if ("asOfDate" in period) return period.asOfDate;
  const { year, month } = period;
  if (month) {
    return new Date(year, month, 0);
  }
  return new Date(year, 11, 31);
}

export const accountsPayableRunner: ControlRunner = {
  controlType: "accounts_payable",

  async execute(ctx: ControlContext): Promise<ControlResult> {
    const asOfDate = resolveAsOfDate(ctx.period);
    const entries = await ctx.adapter.getAccountsPayable(asOfDate);

    const result = runAccountsPayableControl(entries, asOfDate, {
      overdueWarningDays: ctx.parameters.overdueWarningDays as number,
      overdueErrorDays: ctx.parameters.overdueErrorDays as number,
      totalOverdueWarningAmount: ctx.parameters.totalOverdueWarningAmount as number,
      supplierOverdueWarningAmount: ctx.parameters.supplierOverdueWarningAmount as number,
    });

    result.sourceLabel = ctx.adapter.systemName;
    return result;
  },
};
