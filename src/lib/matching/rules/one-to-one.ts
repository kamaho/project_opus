import type {
  MatchCandidate,
  MatchingRule,
  PipelineContext,
  RuleHandler,
  IndexedTransaction,
} from "../types";
import { buildIndexesFromMap } from "../indexer";
import { getCompareAmount, amountDifference } from "../matchers/amount";
import { datesMatch } from "../matchers/date";
import { allConditionsMatch } from "../matchers/fields";
import { scoreOneToOne } from "../scorer";
import { selectBestNonOverlapping } from "../selector";

/**
 * 1:1 matching — each transaction in Set 1 matched against exactly one in Set 2.
 *
 * Algorithm:
 *   1. Build hash index on Set 2 amounts (negated).
 *   2. For each tx in Set 1, look up candidates in Set 2 by negated amount.
 *   3. Filter candidates by date, conditions, and tolerance.
 *   4. Score each pair and collect raw candidates.
 *   5. Use greedy selector to pick best non-overlapping matches.
 */
export const oneToOneHandler: RuleHandler = {
  findMatches(rule: MatchingRule, ctx: PipelineContext): MatchCandidate[] {
    const set2Index = buildIndexesFromMap(ctx.unmatchedSet2);
    const toleranceOre = rule.allowTolerance ? rule.toleranceAmountOre : 0;
    const rawCandidates: MatchCandidate[] = [];

    for (const tx1 of ctx.unmatchedSet1.values()) {
      const amount1 = getCompareAmount(tx1, rule.compareCurrency);
      const targetAmount = -amount1;

      const candidateIds = findAmountCandidates(
        targetAmount,
        toleranceOre,
        set2Index.byAmount
      );

      for (const id2 of candidateIds) {
        if (!ctx.unmatchedSet2.has(id2)) continue;
        const tx2 = set2Index.byId.get(id2)!;
        const amount2 = getCompareAmount(tx2, rule.compareCurrency);
        const diff = amountDifference(amount1, amount2);

        if (toleranceOre > 0 && diff > toleranceOre) continue;
        if (toleranceOre === 0 && diff !== 0) continue;
        if (!datesMatch(tx1, tx2, rule)) continue;
        if (!allConditionsMatch(rule.conditions, tx1, tx2)) continue;

        const score = scoreOneToOne(tx1, tx2, diff, rule);
        rawCandidates.push({
          set1Ids: [tx1.id],
          set2Ids: [tx2.id],
          ruleId: rule.id,
          ruleName: rule.name,
          rulePriority: rule.priority,
          score,
          differenceOre: diff,
        });
      }
    }

    return selectBestNonOverlapping(rawCandidates);
  },
};

/**
 * Find transaction IDs whose amount is within [target - tolerance, target + tolerance].
 * When tolerance is 0 this is a single O(1) hash lookup.
 * When tolerance > 0 we scan a range — still fast because amounts cluster tightly.
 */
function findAmountCandidates(
  targetOre: number,
  toleranceOre: number,
  byAmount: Map<number, Set<string>>
): string[] {
  if (toleranceOre === 0) {
    const exact = byAmount.get(targetOre);
    return exact ? Array.from(exact) : [];
  }

  const results: string[] = [];
  const lo = targetOre - toleranceOre;
  const hi = targetOre + toleranceOre;
  for (const [amount, ids] of byAmount) {
    if (amount >= lo && amount <= hi) {
      for (const id of ids) results.push(id);
    }
  }
  return results;
}
