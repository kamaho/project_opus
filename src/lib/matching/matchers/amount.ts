import type { IndexedTransaction, MatchingRule } from "../types";

/**
 * Get the comparison amount (in øre) depending on rule currency setting.
 */
export function getCompareAmount(
  tx: IndexedTransaction,
  currency: MatchingRule["compareCurrency"]
): number {
  if (currency === "foreign" && tx.foreignAmountOre != null) {
    return tx.foreignAmountOre;
  }
  return tx.amountOre;
}

/**
 * Check whether two amounts match within the given tolerance (in øre).
 * For cross-set matching, amounts should be negated (Set 1 = +100, Set 2 = -100).
 */
export function amountsMatch(
  a: number,
  b: number,
  toleranceOre: number
): boolean {
  return Math.abs(a + b) <= toleranceOre;
}

/**
 * Compute the absolute difference between two negated amounts (in øre).
 */
export function amountDifference(a: number, b: number): number {
  return Math.abs(a + b);
}
