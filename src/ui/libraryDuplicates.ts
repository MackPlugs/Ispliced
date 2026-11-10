export type HashedEntry = { hash: string | null };

/** Counts entries sharing each content hash, ignoring files that appear once. */
export function duplicateCounts<T extends HashedEntry>(entries: T[]) {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.hash) continue;
    counts.set(entry.hash, (counts.get(entry.hash) ?? 0) + 1);
  }

  for (const [hash, count] of counts) {
    if (count < 2) counts.delete(hash);
  }
  return counts;
}
