import type { IndexedTransaction, TransactionIndexes } from "./types";

/**
 * Convert a Date or "YYYY-MM-DD" string to epoch-day (integer days since 1970-01-01).
 */
export function toEpochDay(d: Date | string): number {
  const ms = typeof d === "string" ? new Date(d + "T00:00:00Z").getTime() : d.getTime();
  return Math.floor(ms / 86_400_000);
}

export function fromEpochDay(epochDay: number): string {
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Convert a numeric amount (string or number) to integer øre.
 * Uses Math.round to avoid floating-point drift.
 */
export function toOre(amount: string | number | null | undefined): number {
  if (amount == null) return 0;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Math.round(n * 100);
}

/**
 * Build hash indexes for a collection of transactions.
 * All indexes are O(n) to build and O(1) per lookup.
 */
export function buildIndexes(txs: IndexedTransaction[]): TransactionIndexes {
  const byAmount = new Map<number, Set<string>>();
  const byDate = new Map<number, Set<string>>();
  const byAmountDate = new Map<string, Set<string>>();
  const byId = new Map<string, IndexedTransaction>();

  for (const tx of txs) {
    byId.set(tx.id, tx);

    let amountSet = byAmount.get(tx.amountOre);
    if (!amountSet) {
      amountSet = new Set();
      byAmount.set(tx.amountOre, amountSet);
    }
    amountSet.add(tx.id);

    let dateSet = byDate.get(tx.date);
    if (!dateSet) {
      dateSet = new Set();
      byDate.set(tx.date, dateSet);
    }
    dateSet.add(tx.id);

    const compoundKey = `${tx.amountOre}|${tx.date}`;
    let compoundSet = byAmountDate.get(compoundKey);
    if (!compoundSet) {
      compoundSet = new Set();
      byAmountDate.set(compoundKey, compoundSet);
    }
    compoundSet.add(tx.id);
  }

  return { byAmount, byDate, byAmountDate, byId };
}

/**
 * Rebuild indexes from the unmatched pool in a PipelineContext.
 * Called once before the pipeline starts and optionally between rules
 * if index staleness matters (usually not needed — we filter out matched IDs).
 */
export function buildIndexesFromMap(
  pool: Map<string, IndexedTransaction>
): TransactionIndexes {
  return buildIndexes(Array.from(pool.values()));
}
