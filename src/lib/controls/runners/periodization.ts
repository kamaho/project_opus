import type { PeriodParams } from "@/lib/accounting/types";
import type { ControlContext, ControlRunner } from "../runner";
import type { ControlResult } from "../types";
import { runPeriodizationControl } from "../engines/periodization";

function resolvePeriod(period: ControlContext["period"]): PeriodParams {
  if ("asOfDate" in period) {
    const d = period.asOfDate;
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  return period;
}

export const periodizationRunner: ControlRunner = {
  controlType: "periodization",

  async execute(ctx: ControlContext): Promise<ControlResult> {
    const period = resolvePeriod(ctx.period);

    const prepaidAccounts = (ctx.parameters.prepaidAccounts as string[]) ?? ["17"];
    const accruedAccounts = (ctx.parameters.accruedAccounts as string[]) ?? ["29"];

    const trialBalance = await ctx.adapter.getTrialBalance(
      period,
      [...prepaidAccounts, ...accruedAccounts]
    );

    const result = runPeriodizationControl(trialBalance, period, {
      prepaidAccounts,
      accruedAccounts,
      minBalance: (ctx.parameters.minBalance as number) ?? 5_000,
      flagStaleAccounts: (ctx.parameters.flagStaleAccounts as boolean) ?? true,
    });

    result.sourceLabel = ctx.adapter.systemName;
    return result;
  },
};
