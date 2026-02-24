import type {
  IndexedTransaction,
  MatchCandidate,
  MatchingResult,
  MatchingRule,
  PipelineContext,
  RuleHandler,
  RuleStats,
} from "./types";
import { oneToOneHandler } from "./rules/one-to-one";
import { manyToOneHandler } from "./rules/many-to-one";
import { manyToManyHandler } from "./rules/many-to-many";
import { internalOneToOneHandler, internalManyToOneHandler } from "./rules/internal";

const RULE_TIME_LIMIT_MS = 5_000;
const EXPENSIVE_RULE_POOL_LIMIT = 5_000;

/**
 * Resolve the correct rule handler based on rule type and internal flag.
 */
function getHandler(rule: MatchingRule): RuleHandler {
  if (rule.isInternal) {
    if (rule.ruleType === "one_to_one") return internalOneToOneHandler;
    return internalManyToOneHandler;
  }
  switch (rule.ruleType) {
    case "one_to_one":
      return oneToOneHandler;
    case "many_to_one":
      return manyToOneHandler;
    case "many_to_many":
      return manyToManyHandler;
  }
}

function isExpensiveRule(rule: MatchingRule): boolean {
  return rule.ruleType === "many_to_one" || rule.ruleType === "many_to_many";
}

/**
 * Remove matched transaction IDs from the unmatched pools.
 * Validates that every candidate has at least 2 transactions.
 */
function commitCandidate(ctx: PipelineContext, candidate: MatchCandidate): void {
  const totalIds = candidate.set1Ids.length + candidate.set2Ids.length;
  if (totalIds < 2) {
    console.warn(
      `[matching] Rejected candidate from rule "${candidate.ruleName}": only ${totalIds} transaction(s)`
    );
    return;
  }
  for (const id of candidate.set1Ids) ctx.unmatchedSet1.delete(id);
  for (const id of candidate.set2Ids) ctx.unmatchedSet2.delete(id);
  ctx.candidates.push(candidate);
}

/**
 * Run the full matching pipeline: execute rules in priority order,
 * each operating on the remaining unmatched transactions.
 */
export function runPipeline(
  rules: MatchingRule[],
  set1: IndexedTransaction[],
  set2: IndexedTransaction[]
): MatchingResult {
  const start = performance.now();

  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  const ctx: PipelineContext = {
    clientId: "",
    unmatchedSet1: new Map(set1.map((t) => [t.id, t])),
    unmatchedSet2: new Map(set2.map((t) => [t.id, t])),
    candidates: [],
  };

  const byRule: RuleStats[] = [];
  const skippedRules: string[] = [];

  for (const rule of sorted) {
    const poolSize = Math.max(ctx.unmatchedSet1.size, ctx.unmatchedSet2.size);

    if (isExpensiveRule(rule) && poolSize > EXPENSIVE_RULE_POOL_LIMIT) {
      skippedRules.push(rule.name);
      console.warn(
        `[matching] Skipping "${rule.name}": pool size ${poolSize} exceeds limit ${EXPENSIVE_RULE_POOL_LIMIT}`
      );
      continue;
    }

    const ruleStart = performance.now();
    const before = ctx.candidates.length;
    const handler = getHandler(rule);
    const newCandidates = handler.findMatches(rule, ctx);
    const elapsed = performance.now() - ruleStart;

    if (elapsed > RULE_TIME_LIMIT_MS) {
      console.warn(
        `[matching] Rule "${rule.name}" took ${Math.round(elapsed)}ms (limit: ${RULE_TIME_LIMIT_MS}ms)`
      );
    }

    for (const c of newCandidates) commitCandidate(ctx, c);

    const matchCount = ctx.candidates.length - before;
    if (matchCount > 0) {
      const txCount = newCandidates.reduce(
        (sum, c) => sum + c.set1Ids.length + c.set2Ids.length,
        0
      );
      byRule.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matchCount,
        transactionCount: txCount,
      });
    }
  }

  const totalTransactions = ctx.candidates.reduce(
    (sum, c) => sum + c.set1Ids.length + c.set2Ids.length,
    0
  );

  return {
    candidates: ctx.candidates,
    stats: {
      totalMatches: ctx.candidates.length,
      totalTransactions,
      byRule,
    },
    durationMs: Math.round(performance.now() - start),
  };
}
