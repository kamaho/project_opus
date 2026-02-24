import { db } from "@/lib/db";
import { matches, transactions, matchingRules, imports } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { toOre, toEpochDay, fromEpochDay } from "./indexer";
import { runPipeline } from "./pipeline";
import type {
  IndexedTransaction,
  MatchCandidate,
  CandidateTransactionSummary,
  MatchingResult,
  MatchingRule,
  FieldCondition,
} from "./types";

function toIndexed(row: {
  id: string;
  setNumber: number;
  amount: string;
  foreignAmount: string | null;
  currency: string | null;
  date1: string;
  date2: string | null;
  reference: string | null;
  description: string | null;
  textCode: string | null;
  accountNumber: string | null;
  dim1: string | null;
  dim2: string | null;
  dim3: string | null;
  dim4: string | null;
  dim5: string | null;
  dim6: string | null;
  dim7: string | null;
  dim8: string | null;
  dim9: string | null;
  dim10: string | null;
}): IndexedTransaction {
  return {
    id: row.id,
    setNumber: row.setNumber as 1 | 2,
    amountOre: toOre(row.amount),
    foreignAmountOre: row.foreignAmount != null ? toOre(row.foreignAmount) : null,
    date: toEpochDay(row.date1),
    date2: row.date2 != null ? toEpochDay(row.date2) : null,
    reference: row.reference,
    description: row.description,
    textCode: row.textCode,
    accountNumber: row.accountNumber,
    currency: row.currency ?? "NOK",
    dimensions: {
      dim1: row.dim1,
      dim2: row.dim2,
      dim3: row.dim3,
      dim4: row.dim4,
      dim5: row.dim5,
      dim6: row.dim6,
      dim7: row.dim7,
      dim8: row.dim8,
      dim9: row.dim9,
      dim10: row.dim10,
    },
  };
}

function toMatchingRule(row: {
  id: string;
  clientId: string | null;
  tenantId: string;
  name: string;
  priority: number;
  isActive: boolean | null;
  ruleType: string;
  isInternal: boolean | null;
  dateMustMatch: boolean | null;
  dateToleranceDays: number | null;
  compareCurrency: string | null;
  allowTolerance: boolean | null;
  toleranceAmount: string | null;
  conditions: unknown;
}): MatchingRule {
  return {
    id: row.id,
    clientId: row.clientId,
    tenantId: row.tenantId,
    name: row.name,
    priority: row.priority,
    isActive: row.isActive ?? true,
    ruleType: row.ruleType as MatchingRule["ruleType"],
    isInternal: row.isInternal ?? false,
    dateMustMatch: row.dateMustMatch ?? true,
    dateToleranceDays: row.dateToleranceDays ?? 0,
    compareCurrency: (row.compareCurrency as MatchingRule["compareCurrency"]) ?? "local",
    allowTolerance: row.allowTolerance ?? false,
    toleranceAmountOre: toOre(row.toleranceAmount),
    conditions: Array.isArray(row.conditions)
      ? (row.conditions as FieldCondition[])
      : [],
  };
}

async function loadUnmatchedTransactions(
  clientId: string
): Promise<{ set1: IndexedTransaction[]; set2: IndexedTransaction[] }> {
  const rows = await db
    .select({
      id: transactions.id,
      setNumber: transactions.setNumber,
      amount: transactions.amount,
      foreignAmount: transactions.foreignAmount,
      currency: transactions.currency,
      date1: transactions.date1,
      date2: transactions.date2,
      reference: transactions.reference,
      description: transactions.description,
      textCode: transactions.textCode,
      accountNumber: transactions.accountNumber,
      dim1: transactions.dim1,
      dim2: transactions.dim2,
      dim3: transactions.dim3,
      dim4: transactions.dim4,
      dim5: transactions.dim5,
      dim6: transactions.dim6,
      dim7: transactions.dim7,
      dim8: transactions.dim8,
      dim9: transactions.dim9,
      dim10: transactions.dim10,
    })
    .from(transactions)
    .leftJoin(imports, eq(transactions.importId, imports.id))
    .where(
      and(
        eq(transactions.clientId, clientId),
        eq(transactions.matchStatus, "unmatched"),
        sql`(${imports.deletedAt} IS NULL OR ${transactions.importId} IS NULL)`
      )
    );

  const set1: IndexedTransaction[] = [];
  const set2: IndexedTransaction[] = [];
  for (const r of rows) {
    const tx = toIndexed(r);
    if (tx.setNumber === 1) set1.push(tx);
    else set2.push(tx);
  }
  return { set1, set2 };
}

async function loadRules(clientId: string): Promise<MatchingRule[]> {
  const rows = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.clientId, clientId))
    .orderBy(matchingRules.priority);

  return rows.map(toMatchingRule);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AutoMatchStats {
  totalMatches: number;
  totalTransactions: number;
  byRule: { ruleId: string; ruleName: string; matchCount: number; transactionCount: number }[];
  durationMs: number;
}

/**
 * Preview: run the pipeline and return only stats (no candidates, no DB writes).
 */
export async function previewAutoMatch(clientId: string): Promise<AutoMatchStats> {
  const [{ set1, set2 }, rules] = await Promise.all([
    loadUnmatchedTransactions(clientId),
    loadRules(clientId),
  ]);

  if (rules.length === 0) {
    return { totalMatches: 0, totalTransactions: 0, byRule: [], durationMs: 0 };
  }

  const result = runPipeline(rules, set1, set2);
  return {
    totalMatches: result.stats.totalMatches,
    totalTransactions: result.stats.totalTransactions,
    byRule: result.stats.byRule,
    durationMs: result.durationMs,
  };
}

export interface AutoMatchResult extends AutoMatchStats {
  /** Each element is one match group: [set1Ids, set2Ids] */
  matchGroups: [string[], string[]][];
}

/**
 * Run the full pipeline and commit all matches in bulk.
 * Returns stats + grouped match IDs for staggered animation.
 */
export async function runAutoMatch(
  clientId: string,
  userId: string
): Promise<AutoMatchResult> {
  const [{ set1, set2 }, rules] = await Promise.all([
    loadUnmatchedTransactions(clientId),
    loadRules(clientId),
  ]);

  if (rules.length === 0) {
    return {
      totalMatches: 0,
      totalTransactions: 0,
      byRule: [],
      durationMs: 0,
      matchGroups: [],
    };
  }

  const result = runPipeline(rules, set1, set2);
  const { candidates } = result;

  if (candidates.length === 0) {
    return {
      ...result.stats,
      durationMs: result.durationMs,
      matchGroups: [],
    };
  }

  const matchGroups: [string[], string[]][] = [];
  await db.transaction(async (tx) => {
    const matchValues = candidates.map((c) => ({
      clientId,
      ruleId: c.ruleId,
      matchType: "auto" as const,
      difference: String(c.differenceOre / 100),
      matchedBy: userId,
    }));

    const matchRows = await tx
      .insert(matches)
      .values(matchValues)
      .returning({ id: matches.id });

    const pairs: { txId: string; matchId: string }[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const mId = matchRows[i].id;
      matchGroups.push([c.set1Ids, c.set2Ids]);
      for (const id of c.set1Ids) pairs.push({ txId: id, matchId: mId });
      for (const id of c.set2Ids) pairs.push({ txId: id, matchId: mId });
    }

    if (pairs.length > 0) {
      const valuesList = pairs.map((p) => `('${p.txId}'::uuid, '${p.matchId}'::uuid)`).join(",");
      await tx.execute(sql`
        UPDATE ${transactions} AS t
        SET match_id = v.match_id, match_status = 'matched'
        FROM (VALUES ${sql.raw(valuesList)}) AS v(tx_id, match_id)
        WHERE t.id = v.tx_id
      `);
    }
  });

  return {
    totalMatches: result.stats.totalMatches,
    totalTransactions: result.stats.totalTransactions,
    byRule: result.stats.byRule,
    durationMs: result.durationMs,
    matchGroups,
  };
}
