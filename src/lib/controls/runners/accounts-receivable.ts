import type { ControlContext, ControlRunner } from "../runner";
import type { ControlResult } from "../types";
import { runAccountsReceivableControl } from "../engines/accounts-receivable";

function resolveAsOfDate(period: ControlContext["period"]): Date {
  if ("asOfDate" in period) return period.asOfDate;
  const { year, month } = period;
  if (month) {
    return new Date(year, month, 0); // last day of month
  }
  return new Date(year, 11, 31);
}

export const accountsReceivableRunner: ControlRunner = {
  controlType: "accounts_receivable",

  async execute(ctx: ControlContext): Promise<ControlResult> {
    const asOfDate = resolveAsOfDate(ctx.period);
    const entries = await ctx.adapter.getAccountsReceivable(asOfDate);

    const result = runAccountsReceivableControl(entries, asOfDate, {
      overdueWarningDays: ctx.parameters.overdueWarningDays as number,
      overdueErrorDays: ctx.parameters.overdueErrorDays as number,
      totalOverdueWarningAmount: ctx.parameters.totalOverdueWarningAmount as number,
      customerOverdueWarningAmount: ctx.parameters.customerOverdueWarningAmount as number,
      minAmount: (ctx.parameters.minAmount as number) ?? 0,
      maxOverdueCount: (ctx.parameters.maxOverdueCount as number) ?? Infinity,
    });

    result.sourceLabel = ctx.adapter.systemName;
    return result;
  },
};
