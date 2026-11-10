export type SearchableEntry = {
  name: string;
  pack: string;
  instrument: string;
  key: string | null;
  kind: string;
  favorite: boolean;
};

/** Case-insensitive match over the fields the library table shows. */
export function filterEntries<T extends SearchableEntry>(entries: T[], query: string, favoritesOnly = false): T[] {
  const pool = favoritesOnly ? entries.filter(entry => entry.favorite) : entries;
  const needle = query.trim().toLowerCase();
  if (!needle) return pool;

  return pool.filter(entry =>
    [entry.name, entry.pack, entry.instrument, entry.key ?? "", entry.kind]
      .some(value => value.toLowerCase().includes(needle)));
}
