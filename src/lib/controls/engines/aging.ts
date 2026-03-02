import type { AgingBucket, AgingEntry } from "../types";

const BUCKET_DEFS = [
  { label: "Ikke forfalt", minDays: -Infinity, maxDays: -1 },
  { label: "0–30 dager", minDays: 0, maxDays: 30 },
  { label: "31–60 dager", minDays: 31, maxDays: 60 },
  { label: "61–90 dager", minDays: 61, maxDays: 90 },
  { label: "Over 90 dager", minDays: 91, maxDays: null },
] as const;

export function calculateDaysOverdue(dueDate: Date, asOfDate: Date): number {
  const diffMs = asOfDate.getTime() - dueDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function buildAgingBuckets(entries: AgingEntry[]): AgingBucket[] {
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);

  const buckets: AgingBucket[] = BUCKET_DEFS.map((def) => ({
    label: def.label,
    minDays: def.minDays === -Infinity ? -999999 : def.minDays,
    maxDays: def.maxDays,
    count: 0,
    totalAmount: 0,
    percentage: 0,
    entries: [],
  }));

  for (const entry of entries) {
    const days = entry.daysOverdue;
    let placed = false;

    for (const bucket of buckets) {
      const min = bucket.minDays;
      const max = bucket.maxDays;
      if (days >= min && (max === null || days <= max)) {
        bucket.count++;
        bucket.totalAmount += entry.amount;
        bucket.entries.push(entry);
        placed = true;
        break;
      }
    }

    if (!placed) {
      buckets[0].count++;
      buckets[0].totalAmount += entry.amount;
      buckets[0].entries.push(entry);
    }
  }

  for (const bucket of buckets) {
    bucket.percentage = totalAmount > 0
      ? Math.round((bucket.totalAmount / totalAmount) * 1000) / 10
      : 0;
  }

  return buckets;
}
