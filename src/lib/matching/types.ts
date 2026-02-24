/**
 * Matching Engine — Core types.
 *
 * Amounts are stored as integers (øre) to avoid floating-point errors.
 * Dates are stored as epoch-days (days since 1970-01-01) for fast arithmetic.
 */

// ---------------------------------------------------------------------------
// Rule configuration (mirrors DB matching_rules, but typed for engine use)
// ---------------------------------------------------------------------------

export type RuleType = "one_to_one" | "many_to_one" | "many_to_many";
export type CompareCurrency = "local" | "foreign";

export interface FieldCondition {
  field: string;
  operator: "equals" | "contains" | "starts_with";
  /** If set, compare against this field on the other side instead of a literal */
  compareField?: string;
  value?: string;
}

export interface MatchingRule {
  id: string;
  clientId: string | null;
  tenantId: string;
  name: string;
  priority: number;
  isActive: boolean;
  ruleType: RuleType;
  isInternal: boolean;
  dateMustMatch: boolean;
  dateToleranceDays: number;
  compareCurrency: CompareCurrency;
  allowTolerance: boolean;
  /** Tolerance in øre (integer) */
  toleranceAmountOre: number;
  conditions: FieldCondition[];
}

// ---------------------------------------------------------------------------
// Indexed transaction (in-memory representation optimised for matching)
// ---------------------------------------------------------------------------

export interface IndexedTransaction {
  id: string;
  setNumber: 1 | 2;
  /** Amount in øre (integer). Positive or negative. */
  amountOre: number;
  /** Foreign amount in øre, null when not present */
  foreignAmountOre: number | null;
  /** Epoch-day for date1 */
  date: number;
  /** Epoch-day for date2, null when not present */
  date2: number | null;
  reference: string | null;
  description: string | null;
  textCode: string | null;
  accountNumber: string | null;
  currency: string;
  /** dim1..dim10 keyed by "dim1", "dim2", etc. */
  dimensions: Record<string, string | null>;
}

// ---------------------------------------------------------------------------
// Match candidate (proposed match before commit)
// ---------------------------------------------------------------------------

export interface CandidateTransactionSummary {
  id: string;
  setNumber: 1 | 2;
  date: string;
  amount: number;
  description: string | null;
}

export interface MatchCandidate {
  set1Ids: string[];
  set2Ids: string[];
  ruleId: string;
  ruleName: string;
  rulePriority: number;
  /** 0–100 confidence score */
  score: number;
  /** Difference in øre (should be 0 or within tolerance) */
  differenceOre: number;
  /** Populated only in preview mode for display */
  set1Transactions?: CandidateTransactionSummary[];
  /** Populated only in preview mode for display */
  set2Transactions?: CandidateTransactionSummary[];
}

// ---------------------------------------------------------------------------
// Pipeline context (mutable state during pipeline execution)
// ---------------------------------------------------------------------------

export interface PipelineContext {
  clientId: string;
  unmatchedSet1: Map<string, IndexedTransaction>;
  unmatchedSet2: Map<string, IndexedTransaction>;
  candidates: MatchCandidate[];
}

// ---------------------------------------------------------------------------
// Pipeline result
// ---------------------------------------------------------------------------

export interface RuleStats {
  ruleId: string;
  ruleName: string;
  matchCount: number;
  transactionCount: number;
}

export interface MatchingResult {
  candidates: MatchCandidate[];
  stats: {
    totalMatches: number;
    totalTransactions: number;
    byRule: RuleStats[];
  };
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Rule handler interface (implemented by each rule type)
// ---------------------------------------------------------------------------

export interface RuleHandler {
  findMatches(rule: MatchingRule, ctx: PipelineContext): MatchCandidate[];
}

// ---------------------------------------------------------------------------
// Indexes built by the indexer for fast lookups
// ---------------------------------------------------------------------------

export interface TransactionIndexes {
  /** amountOre → set of transaction IDs */
  byAmount: Map<number, Set<string>>;
  /** epoch-day → set of transaction IDs */
  byDate: Map<number, Set<string>>;
  /** "${amountOre}|${epochDay}" → set of transaction IDs */
  byAmountDate: Map<string, Set<string>>;
  /** transaction ID → IndexedTransaction */
  byId: Map<string, IndexedTransaction>;
}
