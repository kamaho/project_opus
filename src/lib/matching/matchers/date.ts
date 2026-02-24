import type { IndexedTransaction, MatchingRule } from "../types";

/**
 * Check whether two transactions match on date given rule settings.
 * - If dateMustMatch and tolerance is 0: dates must be identical.
 * - If dateMustMatch and tolerance > 0: dates within ±N days.
 * - If !dateMustMatch: always returns true.
 */
export function datesMatch(
  a: IndexedTransaction,
  b: IndexedTransaction,
  rule: MatchingRule
): boolean {
  if (!rule.dateMustMatch) return true;
  const diff = Math.abs(a.date - b.date);
  return diff <= rule.dateToleranceDays;
}

/**
 * Return the absolute day-distance between two transactions.
 * Used for scoring: closer dates → higher score.
 */
export function dateDelta(a: IndexedTransaction, b: IndexedTransaction): number {
  return Math.abs(a.date - b.date);
}
