import type { PayrollData, PayrollEmployee, PeriodParams } from "@/lib/accounting/types";
import type { ControlResult, Deviation, Severity } from "../types";

export interface PayrollControlConfig {
  tolerance: number;
  checkNetPay: boolean;
  flagMissingPension: boolean;
  flagZeroTax: boolean;
  grossPayWarningThreshold: number;
}

const DEFAULT_CONFIG: PayrollControlConfig = {
  tolerance: 1,
  checkNetPay: true,
  flagMissingPension: true,
  flagZeroTax: true,
  grossPayWarningThreshold: 0,
};

const NOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

/**
 * Payroll internal consistency control.
 *
 * Without A-melding (Altinn) data, this checks:
 * 1. Net pay consistency: gross - tax - other deductions ≈ net
 * 2. Missing pension contributions
 * 3. Zero tax deductions for employees with gross pay
 * 4. Employer contribution plausibility (14.1% of gross is standard rate)
 *
 * When A-melding data becomes available, extend with cross-source comparison.
 */
export function runPayrollControl(
  payroll: PayrollData,
  period: PeriodParams,
  config?: Partial<PayrollControlConfig>
): ControlResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const deviations: Deviation[] = [];
  let deviationId = 0;

  for (const emp of payroll.employees) {
    if (cfg.checkNetPay) {
      const expectedNet = emp.grossPay - emp.taxDeductions - emp.pensionContributions;
      const netDiff = Math.abs(emp.netPay - expectedNet);
      if (netDiff > cfg.tolerance) {
        deviations.push({
          id: String(++deviationId),
          severity: netDiff > 1000 ? "error" : "warning",
          category: "net_pay",
          description: `Netto lønn for ${emp.name} avviker med ${NOK.format(netDiff)} (forventet ${NOK.format(expectedNet)}, bokført ${NOK.format(emp.netPay)})`,
          reference: emp.employeeId,
          amount: emp.netPay,
          difference: netDiff,
          details: {
            employeeName: emp.name,
            grossPay: emp.grossPay,
            taxDeductions: emp.taxDeductions,
            pension: emp.pensionContributions,
            expectedNet,
            actualNet: emp.netPay,
          },
        });
      }
    }

    if (cfg.flagZeroTax && emp.grossPay > cfg.grossPayWarningThreshold && emp.taxDeductions === 0) {
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "zero_tax",
        description: `${emp.name} har brutto lønn ${NOK.format(emp.grossPay)} men ingen skattetrekk`,
        reference: emp.employeeId,
        amount: emp.grossPay,
        details: { employeeName: emp.name },
      });
    }

    if (cfg.flagMissingPension && emp.grossPay > cfg.grossPayWarningThreshold && emp.pensionContributions === 0) {
      deviations.push({
        id: String(++deviationId),
        severity: "info",
        category: "missing_pension",
        description: `${emp.name} har ingen pensjonsinnbetaling til tross for brutto lønn ${NOK.format(emp.grossPay)}`,
        reference: emp.employeeId,
        amount: emp.grossPay,
        details: { employeeName: emp.name },
      });
    }
  }

  // Aggregate-level checks
  const { totals } = payroll;

  // Employer contribution plausibility (standard AGA in Norway: ~14.1%)
  if (totals.grossPay > 0) {
    const agaRate = totals.employerContributions / totals.grossPay;
    if (agaRate < 0.10 || agaRate > 0.20) {
      const pct = (agaRate * 100).toFixed(1);
      deviations.push({
        id: String(++deviationId),
        severity: "warning",
        category: "aga_rate",
        description: `Arbeidsgiveravgift er ${pct}% av brutto lønn (forventet ~14.1%). Sjekk sone og beregning.`,
        reference: "Arbeidsgiveravgift",
        amount: totals.employerContributions,
        difference: totals.employerContributions - totals.grossPay * 0.141,
        details: {
          grossPay: totals.grossPay,
          employerContributions: totals.employerContributions,
          rate: agaRate,
        },
      });
    }
  }

  // Sum consistency: sum of individual gross should match totals.grossPay
  const sumGross = payroll.employees.reduce((s, e) => s + e.grossPay, 0);
  const grossDiff = Math.abs(sumGross - totals.grossPay);
  if (grossDiff > cfg.tolerance) {
    deviations.push({
      id: String(++deviationId),
      severity: "error",
      category: "gross_sum",
      description: `Sum brutto per ansatt (${NOK.format(sumGross)}) avviker fra totalt (${NOK.format(totals.grossPay)}) med ${NOK.format(grossDiff)}`,
      reference: "Brutto sum",
      amount: totals.grossPay,
      difference: grossDiff,
    });
  }

  const sevCounts: Record<Severity, number> = { ok: 0, info: 0, warning: 0, error: 0 };
  for (const d of deviations) sevCounts[d.severity]++;

  let overallStatus: Severity = "ok";
  if (sevCounts.error > 0) overallStatus = "error";
  else if (sevCounts.warning > 0) overallStatus = "warning";
  else if (sevCounts.info > 0) overallStatus = "info";

  const totalDeviationAmount = deviations
    .filter((d) => d.severity === "error" || d.severity === "warning")
    .reduce((s, d) => s + Math.abs(d.difference ?? d.amount), 0);

  return {
    controlType: "payroll_a07",
    title: "Lønnsavstemming — internkonsistens",
    period,
    executedAt: new Date(),
    overallStatus,
    summary: {
      totalChecked: payroll.employees.length,
      totalDeviations: deviations.length,
      totalDeviationAmount,
      deviationsBySeverity: sevCounts,
    },
    deviations,
    sourceLabel: "",
    metadata: {
      employeeCount: payroll.employees.length,
      totals,
      note: "Intern konsistenskontroll. Krysssjekk mot A-melding (Altinn) er ikke tilgjengelig ennå.",
    },
  };
}
