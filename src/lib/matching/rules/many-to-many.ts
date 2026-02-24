import type {
  MatchCandidate,
  MatchingRule,
  PipelineContext,
  RuleHandler,
  IndexedTransaction,
} from "../types";
import { getCompareAmount } from "../matchers/amount";
import { scoreGroup } from "../scorer";
import { selectBestNonOverlapping } from "../selector";

const MAX_PER_SIDE = 6;
const MAX_CLUSTER_SIZE = 20;
const MAX_SUBSET_ENUMERATIONS = 50_000;

/**
 * Many:Many matching — subsets from both sets that sum to 0.
 *
 * Strategy:
 *   1. Build clusters of transactions with similar dates and/or references.
 *   2. Within each cluster, enumerate partition pairs (Set 1 subset, Set 2 subset)
 *      that balance to 0 +/- tolerance.
 *   3. Score and select best non-overlapping.
 */
export const manyToManyHandler: RuleHandler = {
  findMatches(rule: MatchingRule, ctx: PipelineContext): MatchCandidate[] {
    const toleranceOre = rule.allowTolerance ? rule.toleranceAmountOre : 0;
    const clusters = buildClusters(rule, ctx);
    const raw: MatchCandidate[] = [];

    for (const cluster of clusters) {
      const set1Txs = cluster.filter((t) => t.setNumber === 1);
      const set2Txs = cluster.filter((t) => t.setNumber === 2);
      if (set1Txs.length === 0 || set2Txs.length === 0) continue;

      const pairs = findBalancingPairs(
        set1Txs,
        set2Txs,
        toleranceOre,
        rule.compareCurrency,
        MAX_PER_SIDE
      );

      for (const { s1, s2, diff } of pairs) {
        const score = scoreGroup(s1, s2, diff, rule);
        raw.push({
          set1Ids: s1.map((t) => t.id),
          set2Ids: s2.map((t) => t.id),
          ruleId: rule.id,
          ruleName: rule.name,
          rulePriority: rule.priority,
          score,
          differenceOre: diff,
        });
      }
    }

    return selectBestNonOverlapping(raw);
  },
};

function buildClusters(
  rule: MatchingRule,
  ctx: PipelineContext
): IndexedTransaction[][] {
  const all = [
    ...Array.from(ctx.unmatchedSet1.values()),
    ...Array.from(ctx.unmatchedSet2.values()),
  ];

  if (rule.dateMustMatch) {
    const byDate = new Map<number, IndexedTransaction[]>();
    for (const tx of all) {
      const dateKey = rule.dateToleranceDays === 0
        ? tx.date
        : Math.floor(tx.date / Math.max(1, rule.dateToleranceDays));

      let group = byDate.get(dateKey);
      if (!group) {
        group = [];
        byDate.set(dateKey, group);
      }
      group.push(tx);
    }

    return Array.from(byDate.values()).filter(
      (g) => g.length >= 2 && g.length <= MAX_CLUSTER_SIZE
    );
  }

  const byRef = new Map<string, IndexedTransaction[]>();
  for (const tx of all) {
    const key = tx.reference?.toLowerCase().trim() || "__no_ref__";
    let group = byRef.get(key);
    if (!group) {
      group = [];
      byRef.set(key, group);
    }
    group.push(tx);
  }

  return Array.from(byRef.values()).filter(
    (g) => g.length >= 2 && g.length <= MAX_CLUSTER_SIZE
  );
}

interface BalancingPair {
  s1: IndexedTransaction[];
  s2: IndexedTransaction[];
  diff: number;
}

function findBalancingPairs(
  set1Txs: IndexedTransaction[],
  set2Txs: IndexedTransaction[],
  toleranceOre: number,
  currency: MatchingRule["compareCurrency"],
  maxPerSide: number
): BalancingPair[] {
  const s1Limited = set1Txs.slice(0, maxPerSide * 2);
  const s2Limited = set2Txs.slice(0, maxPerSide * 2);

  const s1Sums = enumerateSubsetSums(s1Limited, currency, maxPerSide);
  const s2Sums = enumerateSubsetSums(s2Limited, currency, maxPerSide);

  const s2Map = new Map<number, IndexedTransaction[][]>();
  for (const [sum, txs] of s2Sums) {
    let arr = s2Map.get(sum);
    if (!arr) {
      arr = [];
      s2Map.set(sum, arr);
    }
    arr.push(txs);
  }

  let bestDiff = Infinity;
  let bestPair: BalancingPair | null = null;

  for (const [s1Sum, s1Group] of s1Sums) {
    if (s1Group.length === 0) continue;
    const target = -s1Sum;

    if (toleranceOre === 0) {
      const s2Groups = s2Map.get(target);
      if (!s2Groups) continue;
      for (const s2Group of s2Groups) {
        if (s2Group.length === 0) continue;
        bestDiff = 0;
        bestPair = { s1: s1Group, s2: s2Group, diff: 0 };
        break;
      }
      if (bestDiff === 0) break;
    } else {
      for (let d = -toleranceOre; d <= toleranceOre; d++) {
        const s2Groups = s2Map.get(target + d);
        if (!s2Groups) continue;
        for (const s2Group of s2Groups) {
          if (s2Group.length === 0) continue;
          const diff = Math.abs(d);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestPair = { s1: s1Group, s2: s2Group, diff };
          }
        }
      }
    }
  }

  return bestPair ? [bestPair] : [];
}

function enumerateSubsetSums(
  txs: IndexedTransaction[],
  currency: MatchingRule["compareCurrency"],
  maxSize: number
): [number, IndexedTransaction[]][] {
  const results: [number, IndexedTransaction[]][] = [[0, []]];
  let count = 0;
  for (const tx of txs) {
    const amount = getCompareAmount(tx, currency);
    const len = results.length;
    for (let j = 0; j < len; j++) {
      const [sum, group] = results[j];
      if (group.length >= maxSize) continue;
      results.push([sum + amount, [...group, tx]]);
      count++;
      if (count > MAX_SUBSET_ENUMERATIONS) return results;
    }
  }
  return results;
}
