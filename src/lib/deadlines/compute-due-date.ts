import type { DueDateRule, Period, CompanyContext } from "./types";
import { adjustForHolidays } from "./adjust-for-holidays";

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Computes the due date for a deadline given its rule, the period, and company context.
 *
 * For "fixed_annual": returns a fixed date each year (e.g. May 31 for skattemelding).
 *   - Respects `applies_to` if defined: returns null if company orgForm doesn't match.
 *
 * For "offset_after_period": computes based on period end + offset.
 *   - period.month determines the base month (period end).
 *   - If period.month is not set, falls back to fiscal year end from company context.
 *   - offset_months shifts forward from the base.
 *   - day=null means last day of the resulting month.
 *
 * Holiday adjustment is applied by default unless `adjust_for_holidays` is explicitly false.
 */
export function computeDueDate(
  rule: DueDateRule,
  period: Period,
  company?: CompanyContext
): Date | null {
  if (rule.type === "fixed_annual") {
    // V1: orgForm is not yet stored on companies. When orgForm is undefined,
    // applies_to is intentionally bypassed — deadlines are generated for all
    // companies. Once companies.org_form is populated, this filter activates.
    if (rule.applies_to && rule.applies_to.length > 0 && company?.orgForm) {
      if (!rule.applies_to.includes(company.orgForm)) {
        return null;
      }
    }

    const raw = new Date(period.year, rule.month - 1, rule.day);

    if (rule.adjust_for_holidays === false) return raw;
    return adjustForHolidays(raw);
  }

  if (rule.type === "offset_after_period") {
    let baseMonth: number;

    if (period.month !== undefined) {
      baseMonth = period.month - 1;
    } else if (company?.fiscalYearEnd) {
      const [m] = company.fiscalYearEnd.split("-").map(Number);
      baseMonth = (m ?? 12) - 1;
    } else {
      baseMonth = 11;
    }

    const targetMonth = baseMonth + rule.offset_months;
    const targetYear = period.year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;

    let day: number;
    if (rule.day === null) {
      day = lastDayOfMonth(targetYear, normalizedMonth + 1);
    } else {
      const maxDay = lastDayOfMonth(targetYear, normalizedMonth + 1);
      day = Math.min(rule.day, maxDay);
    }

    const raw = new Date(targetYear, normalizedMonth, day);

    if (rule.adjust_for_holidays === false) return raw;
    return adjustForHolidays(raw);
  }

  return null;
}
