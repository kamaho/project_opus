import type { PeriodParams } from "@/lib/accounting/types";
import type { ControlContext, ControlRunner } from "../runner";
import type { ControlResult } from "../types";
import { runPayrollControl } from "../engines/payroll";

function resolvePeriod(period: ControlContext["period"]): PeriodParams {
  if ("asOfDate" in period) {
    const d = period.asOfDate;
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return period;
}

export const payrollRunner: ControlRunner = {
  controlType: "payroll_a07",

  async execute(ctx: ControlContext): Promise<ControlResult> {
    const period = resolvePeriod(ctx.period);
    const payroll = await ctx.adapter.getPayrollData(period);

    const result = runPayrollControl(payroll, period, {
      tolerance: (ctx.parameters.tolerance as number) ?? 1,
      checkNetPay: (ctx.parameters.checkNetPay as boolean) ?? true,
      flagMissingPension: (ctx.parameters.flagMissingPension as boolean) ?? true,
      flagZeroTax: (ctx.parameters.flagZeroTax as boolean) ?? true,
      grossPayWarningThreshold: (ctx.parameters.grossPayWarningThreshold as number) ?? 0,
    });

    result.sourceLabel = ctx.adapter.systemName;
    return result;
  },
};
