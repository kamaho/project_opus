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
import { scoreOneToOne, scoreGroup } from "../scorer";
import { selectBestNonOverlapping } from "../selector";

const MAX_INTERNAL_GROUP = 8;
const MAX_CANDIDATES_PER_ANCHOR = 20;
const MAX_ITERATIONS = 100_000;

/**
 * Internal 1:1 matching — match transactions within the same set.
 * E.g. a +500 and -500 in Set 1 that cancel each other out.
 */
export const internalOneToOneHandler: RuleHandler = {
  findMatches(rule: MatchingRule, ctx: PipelineContext): MatchCandidate[] {
    const raw: MatchCandidate[] = [];
    matchWithinPool(rule, ctx.unmatchedSet1, raw);
    matchWithinPool(rule, ctx.unmatchedSet2, raw);
    return selectBestNonOverlapping(raw);
  },
};

function matchWithinPool(
  rule: MatchingRule,
  pool: Map<string, IndexedTransaction>,
  out: MatchCandidate[]
): void {
  const index = buildIndexesFromMap(pool);
  const toleranceOre = rule.allowTolerance ? rule.toleranceAmountOre : 0;
  const visited = new Set<string>();

  for (const tx of pool.values()) {
    if (visited.has(tx.id)) continue;
    const amount = getCompareAmount(tx, rule.compareCurrency);
    const targetAmount = -amount;

    const candidates = index.byAmount.get(targetAmount);
    if (!candidates) continue;

    for (const otherId of candidates) {
      if (otherId === tx.id || visited.has(otherId)) continue;
      const other = index.byId.get(otherId)!;
      const otherAmount = getCompareAmount(other, rule.compareCurrency);
      const diff = amountDifference(amount, otherAmount);

      if (toleranceOre === 0 && diff !== 0) continue;
      if (toleranceOre > 0 && diff > toleranceOre) continue;
      if (!datesMatch(tx, other, rule)) continue;
      if (!allConditionsMatch(rule.conditions, tx, other)) continue;

      const score = scoreOneToOne(tx, other, diff, rule);
      visited.add(tx.id);
      visited.add(otherId);

      const ids = [tx.id, otherId];
      const isSet1 = tx.setNumber === 1;
      out.push({
        set1Ids: isSet1 ? ids : [],
        set2Ids: isSet1 ? [] : ids,
        ruleId: rule.id,
        ruleName: rule.name,
        rulePriority: rule.priority,
        score,
        differenceOre: diff,
      });
      break;
    }
  }
}

/**
 * Internal Many:1 matching — multiple transactions within the same set
 * that sum to a single transaction in the same set.
 */
export const internalManyToOneHandler: RuleHandler = {
  findMatches(rule: MatchingRule, ctx: PipelineContext): MatchCandidate[] {
    const raw: MatchCandidate[] = [];
    internalManyToOneInPool(rule, ctx.unmatchedSet1, raw);
    internalManyToOneInPool(rule, ctx.unmatchedSet2, raw);
    return selectBestNonOverlapping(raw);
  },
};

function internalManyToOneInPool(
  rule: MatchingRule,
  pool: Map<string, IndexedTransaction>,
  out: MatchCandidate[]
): void {
  const toleranceOre = rule.allowTolerance ? rule.toleranceAmountOre : 0;
  const txs = Array.from(pool.values());

  for (const anchor of txs) {
    const anchorAmount = getCompareAmount(anchor, rule.compareCurrency);
    const target = -anchorAmount;
    const targetSign = Math.sign(target);

    const candidates: IndexedTransaction[] = [];
    for (const tx of txs) {
      if (tx.id === anchor.id) continue;
      const txAmount = getCompareAmount(tx, rule.compareCurrency);
      if (targetSign !== 0 && Math.sign(txAmount) !== targetSign) continue;
      if (!datesMatch(anchor, tx, rule)) continue;
      if (!allConditionsMatch(rule.conditions, anchor, tx)) continue;
      candidates.push(tx);
      if (candidates.length >= MAX_CANDIDATES_PER_ANCHOR) break;
    }
    if (candidates.length < 2) continue;

    const subset = findBestSubset(candidates, target, toleranceOre, rule, MAX_INTERNAL_GROUP);
    if (!subset) continue;

    const allTxs = [anchor, ...subset];
    const totalAmount = allTxs.reduce(
      (s, t) => s + getCompareAmount(t, rule.compareCurrency),
      0
    );
    const diff = Math.abs(totalAmount);

    const isSet1 = anchor.setNumber === 1;
    const ids = allTxs.map((t) => t.id);
    const score = scoreGroup(
      isSet1 ? allTxs : [],
      isSet1 ? [] : allTxs,
      diff,
      rule
    );

    out.push({
      set1Ids: isSet1 ? ids : [],
      set2Ids: isSet1 ? [] : ids,
      ruleId: rule.id,
      ruleName: rule.name,
      rulePriority: rule.priority,
      score,
      differenceOre: diff,
    });
  }
}

function findBestSubset(
  candidates: IndexedTransaction[],
  target: number,
  tolerance: number,
  rule: MatchingRule,
  maxSize: number
): IndexedTransaction[] | null {
  const limited = candidates.slice(0, MAX_CANDIDATES_PER_ANCHOR);
  const amounts = limited.map((c) => getCompareAmount(c, rule.compareCurrency));

  let bestDiff = Infinity;
  let bestPick: number[] | null = null;
  let iterations = 0;

  const sorted = amounts
    .map((a, i) => ({ amount: a, index: i }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  function backtrack(pos: number, remaining: number, picked: number[]): void {
    iterations++;
    if (iterations > MAX_ITERATIONS) return;

    const diff = Math.abs(remaining);
    if (diff <= tolerance && picked.length >= 2) {
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPick = [...picked];
      }
    }
    if (picked.length >= maxSize || pos >= sorted.length) return;
    if (bestDiff === 0) return;

    for (let i = pos; i < sorted.length; i++) {
      picked.push(sorted[i].index);
      backtrack(i + 1, remaining - sorted[i].amount, picked);
      picked.pop();
      if (bestDiff === 0 || iterations > MAX_ITERATIONS) return;
    }
  }

  backtrack(0, target, []);
  if (!bestPick) return null;
  const pick: number[] = bestPick;
  return pick.map((i) => limited[i]);
}
