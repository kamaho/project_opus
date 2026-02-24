import type {
  MatchCandidate,
  MatchingRule,
  PipelineContext,
  RuleHandler,
  IndexedTransaction,
} from "../types";
import { getCompareAmount } from "../matchers/amount";
import { datesMatch } from "../matchers/date";
import { allConditionsMatch } from "../matchers/fields";
import { scoreGroup } from "../scorer";
import { selectBestNonOverlapping } from "../selector";

const MAX_GROUP_SIZE = 8;
const MAX_CANDIDATES_PER_ANCHOR = 30;
const MAX_ITERATIONS = 100_000;

/**
 * Many:1 matching — multiple transactions on one side match a single
 * transaction on the other. Tries Set 2 as anchor first, then Set 1.
 */
export const manyToOneHandler: RuleHandler = {
  findMatches(rule: MatchingRule, ctx: PipelineContext): MatchCandidate[] {
    const toleranceOre = rule.allowTolerance ? rule.toleranceAmountOre : 0;
    const raw: MatchCandidate[] = [];

    findAnchored(rule, ctx.unmatchedSet2, ctx.unmatchedSet1, toleranceOre, false, raw);
    findAnchored(rule, ctx.unmatchedSet1, ctx.unmatchedSet2, toleranceOre, true, raw);

    return selectBestNonOverlapping(raw);
  },
};

function findAnchored(
  rule: MatchingRule,
  anchors: Map<string, IndexedTransaction>,
  pool: Map<string, IndexedTransaction>,
  toleranceOre: number,
  anchorIsSet1: boolean,
  out: MatchCandidate[]
): void {
  for (const anchor of anchors.values()) {
    const anchorAmount = getCompareAmount(anchor, rule.compareCurrency);
    const target = -anchorAmount;

    const candidates: IndexedTransaction[] = [];
    for (const tx of pool.values()) {
      if (!datesMatch(anchor, tx, rule)) continue;
      if (!allConditionsMatch(rule.conditions, anchor, tx)) continue;
      const txAmount = getCompareAmount(tx, rule.compareCurrency);
      if (Math.sign(txAmount) !== Math.sign(target) && target !== 0) continue;
      candidates.push(tx);
      if (candidates.length >= MAX_CANDIDATES_PER_ANCHOR) break;
    }

    if (candidates.length < 2) continue;

    const subsets = findSubsetSum(
      candidates,
      target,
      toleranceOre,
      rule.compareCurrency,
      MAX_GROUP_SIZE
    );

    for (const subset of subsets) {
      const subsetAmount = subset.reduce(
        (s, t) => s + getCompareAmount(t, rule.compareCurrency),
        0
      );
      const diff = Math.abs(subsetAmount - target);

      const set1Txs = anchorIsSet1 ? [anchor] : subset;
      const set2Txs = anchorIsSet1 ? subset : [anchor];

      const score = scoreGroup(set1Txs, set2Txs, diff, rule);
      out.push({
        set1Ids: set1Txs.map((t) => t.id),
        set2Ids: set2Txs.map((t) => t.id),
        ruleId: rule.id,
        ruleName: rule.name,
        rulePriority: rule.priority,
        score,
        differenceOre: diff,
      });
    }
  }
}

function findSubsetSum(
  candidates: IndexedTransaction[],
  targetOre: number,
  toleranceOre: number,
  currency: MatchingRule["compareCurrency"],
  maxSize: number
): IndexedTransaction[][] {
  const limited = candidates.slice(0, MAX_CANDIDATES_PER_ANCHOR);
  const amounts = limited.map((c) => getCompareAmount(c, currency));

  if (limited.length <= 20) {
    return meetInTheMiddle(limited, amounts, targetOre, toleranceOre, maxSize);
  }
  return greedyBacktrack(limited, amounts, targetOre, toleranceOre, maxSize);
}

function meetInTheMiddle(
  txs: IndexedTransaction[],
  amounts: number[],
  target: number,
  tolerance: number,
  maxSize: number
): IndexedTransaction[][] {
  const mid = Math.floor(txs.length / 2);
  const leftSums = enumerateSubsets(amounts.slice(0, mid), maxSize);
  const rightSums = enumerateSubsets(amounts.slice(mid), maxSize);

  const rightMap = new Map<number, number[][]>();
  for (const [sum, indices] of rightSums) {
    let arr = rightMap.get(sum);
    if (!arr) {
      arr = [];
      rightMap.set(sum, arr);
    }
    arr.push(indices);
  }

  let bestDiff = Infinity;
  let bestIndices: number[] | null = null;

  for (const [leftSum, leftIndices] of leftSums) {
    const need = target - leftSum;
    if (tolerance === 0) {
      const rightEntries = rightMap.get(need);
      if (!rightEntries) continue;
      for (const rightIdx of rightEntries) {
        const combined = [...leftIndices, ...rightIdx.map((i) => i + mid)];
        if (combined.length < 2 || combined.length > maxSize) continue;
        bestIndices = combined;
        bestDiff = 0;
        break;
      }
      if (bestDiff === 0) break;
    } else {
      for (let d = -tolerance; d <= tolerance; d++) {
        const rightEntries = rightMap.get(need + d);
        if (!rightEntries) continue;
        for (const rightIdx of rightEntries) {
          const combined = [...leftIndices, ...rightIdx.map((i) => i + mid)];
          if (combined.length < 2 || combined.length > maxSize) continue;
          const diff = Math.abs(d);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIndices = combined;
          }
        }
      }
    }
  }

  if (!bestIndices) return [];
  return [bestIndices.map((i) => txs[i])];
}

function enumerateSubsets(
  amounts: number[],
  maxSize: number
): [number, number[]][] {
  const results: [number, number[]][] = [[0, []]];
  for (let i = 0; i < amounts.length; i++) {
    const len = results.length;
    for (let j = 0; j < len; j++) {
      const [sum, indices] = results[j];
      if (indices.length >= maxSize) continue;
      results.push([sum + amounts[i], [...indices, i]]);
    }
  }
  return results;
}

function greedyBacktrack(
  txs: IndexedTransaction[],
  amounts: number[],
  target: number,
  tolerance: number,
  maxSize: number
): IndexedTransaction[][] {
  const indexed = amounts
    .map((a, i) => ({ amount: a, index: i }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  let bestDiff = Infinity;
  let bestPick: number[] | null = null;
  let iterations = 0;

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
    if (picked.length >= maxSize || pos >= indexed.length) return;
    if (bestDiff === 0) return;

    for (let i = pos; i < indexed.length; i++) {
      const { amount, index } = indexed[i];
      picked.push(index);
      backtrack(i + 1, remaining - amount, picked);
      picked.pop();
      if (bestDiff === 0 || iterations > MAX_ITERATIONS) return;
    }
  }

  backtrack(0, target, []);

  if (!bestPick) return [];
  const pick: number[] = bestPick;
  return [pick.map((i) => txs[i])];
}
