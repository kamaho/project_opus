import type { MatchCandidate } from "./types";

/**
 * Given a list of raw candidates (potentially overlapping), select the
 * best non-overlapping set using a greedy algorithm:
 *
 *   1. Sort by score descending.
 *   2. Walk through; accept a candidate only if none of its transaction IDs
 *      have already been claimed.
 *
 * O(n log n) for the sort + O(n × k) for the scan, where k = avg IDs per candidate.
 */
export function selectBestNonOverlapping(
  candidates: MatchCandidate[]
): MatchCandidate[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const claimed = new Set<string>();
  const selected: MatchCandidate[] = [];

  for (const c of sorted) {
    const allIds = [...c.set1Ids, ...c.set2Ids];
    if (allIds.some((id) => claimed.has(id))) continue;
    for (const id of allIds) claimed.add(id);
    selected.push(c);
  }

  return selected;
}
