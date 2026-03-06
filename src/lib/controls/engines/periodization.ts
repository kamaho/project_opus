import type { TrialBalanceEntry, PeriodParams } from "@/lib/accounting/types";
import type { ControlResult, Deviation, Severity } from "../types";

export interface PeriodizationControlConfig {
  /** Account ranges for prepaid expenses (1700-series) */
  prepaidAccounts: string[];
  /** Account ranges for accrued expenses (2900-series) */
  accruedAccounts: string[];
  /** Ignore accounts with absolute balance below this threshold */
  minBalance: number;
  /** Flag accounts with balance but no movement in the period */
  flagStaleAccounts: boolean;
}

const DEFAULT_CONFIG: PeriodizationControlConfig = {
  prepaidAccounts: ["17"],
  accruedAccounts: ["29"],
  minBalance: 5_000,
  flagStaleAccounts: true,
};

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

/**
 * Periodization check.
 *
 * Examines balance sheet accounts related to prepaid/accrued expenses:
 * - Flags accounts with balance but no movement (stale periodizations)
 * - Flags unusually large balances relative to period movement
 */
export function runPeriodizationControl(
  trialBalance: TrialBalanceEntry[],
  period: PeriodParams,
  config?: Partial<PeriodizationControlConfig>
): ControlResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const deviations: Deviation[] = [];
  let deviationId = 0;

  const allPrefixes = [...cfg.prepaidAccounts, ...cfg.accruedAccounts];
  const relevant = trialBalance.filter((entry) =>
    allPrefixes.some((prefix) => entry.accountNumber.startsWith(prefix))
  );

  for (const account of relevant) {
    const absBalance = Math.abs(account.closingBalance);
    if (absBalance < cfg.minBalance) continue;

    const hasMovement = account.periodDebit !== 0 || account.periodCredit !== 0;

    if (cfg.flagStaleAccounts && !hasMovement) {
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "stale_periodization",
        description: `Konto ${account.accountNumber} (${account.accountName}) har saldo ${NOK.format(account.closingBalance)} uten bevegelse i perioden`,
        reference: account.accountNumber,
        amount: account.closingBalance,
        details: {
          accountName: account.accountName,
          openingBalance: account.openingBalance,
          closingBalance: account.closingBalance,
        },
      });
    }

    // Flag large balance relative to periodic movement
    if (hasMovement) {
      const totalMovement = account.periodDebit + account.periodCredit;
      if (totalMovement > 0 && absBalance > totalMovement * 3) {
        deviations.push({
          id: String(++deviationId),
          severity: "info",
          category: "large_balance",
          description: `Konto ${account.accountNumber} (${account.accountName}) har uvanlig høy saldo (${NOK.format(account.closingBalance)}) sammenlignet med periodens bevegelse (${NOK.format(totalMovement)})`,
          reference: account.accountNumber,
          amount: account.closingBalance,
          difference: absBalance - totalMovement,
          details: {
            accountName: account.accountName,
            closingBalance: account.closingBalance,
            periodMovement: totalMovement,
            ratio: Math.round((absBalance / totalMovement) * 10) / 10,
          },
        });
      }
    }
  }

  const sevCounts: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };
  for (const d of deviations) sevCounts[d.severity]++;

  let overallStatus: Severity = "ok";
  if (sevCounts.error > 0) overallStatus = "error";
  else if (sevCounts.warning > 0) overallStatus = "warning";
  else if (sevCounts.info > 0) overallStatus = "info";

  return {
    controlType: "periodization",
    title: "Periodiseringskontroll",
    period,
    executedAt: new Date(),
    overallStatus,
    summary: {
      totalChecked: relevant.length,
      totalDeviations: deviations.length,
      totalDeviationAmount: deviations.reduce((s, d) => s + Math.abs(d.amount), 0),
      deviationsBySeverity: sevCounts,
    },
    deviations,
    sourceLabel: "",
    metadata: {
      accountsChecked: relevant.length,
      accountsSkipped: trialBalance.length - relevant.length,
      staleCount: deviations.filter((d) => d.category === "stale_periodization").length,
    },
  };
}
