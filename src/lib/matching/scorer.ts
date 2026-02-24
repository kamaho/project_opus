import type { IndexedTransaction, MatchingRule } from "./types";
import { dateDelta } from "./matchers/date";

/**
 * Compute a 0–100 confidence score for a candidate match pair.
 *
 * Scoring breakdown (weights sum to 100):
 *  - Amount exactness   : 40 pts  (0 difference = full, decays with tolerance usage)
 *  - Date proximity     : 30 pts  (same day = full, decays over tolerance window)
 *  - Reference match    : 15 pts  (exact = full, partial = half)
 *  - Description match  : 10 pts  (exact = full, partial = half)
 *  - Fewer transactions :  5 pts  (1:1 preferred over many:1)
 */

const W_AMOUNT = 40;
const W_DATE = 30;
const W_REFERENCE = 15;
const W_DESCRIPTION = 10;
const W_COUNT = 5;

function normalizedStringSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  if (al.includes(bl) || bl.includes(al)) return 0.5;
  return 0;
}

/**
 * Score a 1:1 candidate pair.
 */
export function scoreOneToOne(
  a: IndexedTransaction,
  b: IndexedTransaction,
  differenceOre: number,
  rule: MatchingRule
): number {
  let score = 0;

  // Amount: full points when exact, linear decay towards tolerance
  if (differenceOre === 0) {
    score += W_AMOUNT;
  } else if (rule.toleranceAmountOre > 0) {
    score += W_AMOUNT * (1 - differenceOre / rule.toleranceAmountOre);
  }

  // Date proximity
  const dayDiff = dateDelta(a, b);
  if (dayDiff === 0) {
    score += W_DATE;
  } else if (rule.dateToleranceDays > 0) {
    score += W_DATE * Math.max(0, 1 - dayDiff / rule.dateToleranceDays);
  }

  // Reference
  score += W_REFERENCE * normalizedStringSimilarity(a.reference, b.reference);

  // Description
  score += W_DESCRIPTION * normalizedStringSimilarity(a.description, b.description);

  // Count bonus (1:1 always gets full bonus)
  score += W_COUNT;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Score a many:1 or many:many candidate group.
 * Uses average pairwise scores for date/reference, plus group-size penalty.
 */
export function scoreGroup(
  set1Txs: IndexedTransaction[],
  set2Txs: IndexedTransaction[],
  differenceOre: number,
  rule: MatchingRule
): number {
  let score = 0;

  // Amount
  if (differenceOre === 0) {
    score += W_AMOUNT;
  } else if (rule.toleranceAmountOre > 0) {
    score += W_AMOUNT * (1 - Math.abs(differenceOre) / rule.toleranceAmountOre);
  }

  // Date: average proximity across all pairs
  let totalDateScore = 0;
  let pairCount = 0;
  for (const a of set1Txs) {
    for (const b of set2Txs) {
      const dayDiff = dateDelta(a, b);
      if (dayDiff === 0) {
        totalDateScore += 1;
      } else if (rule.dateToleranceDays > 0) {
        totalDateScore += Math.max(0, 1 - dayDiff / rule.dateToleranceDays);
      }
      pairCount++;
    }
  }
  if (pairCount > 0) score += W_DATE * (totalDateScore / pairCount);

  // Reference: best pairwise similarity
  let bestRef = 0;
  for (const a of set1Txs) {
    for (const b of set2Txs) {
      bestRef = Math.max(bestRef, normalizedStringSimilarity(a.reference, b.reference));
    }
  }
  score += W_REFERENCE * bestRef;

  // Description: best pairwise similarity
  let bestDesc = 0;
  for (const a of set1Txs) {
    for (const b of set2Txs) {
      bestDesc = Math.max(bestDesc, normalizedStringSimilarity(a.description, b.description));
    }
  }
  score += W_DESCRIPTION * bestDesc;

  // Count penalty: more transactions = lower bonus
  const totalTxs = set1Txs.length + set2Txs.length;
  score += W_COUNT * Math.max(0, 1 - (totalTxs - 2) / 10);

  return Math.round(Math.max(0, Math.min(100, score)));
}
