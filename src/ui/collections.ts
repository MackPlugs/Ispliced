/** A named set of library files, independent of the sample folder layout. */
export type Collection = {
  id: string;
  name: string;
  createdAt: number;
  paths: string[];
};

/** Reads one stored collection defensively, dropping anything malformed. */
export function normalizeCollection(value: unknown): Collection | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;

  return {
    id: record.id,
    name: record.name,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : 0,
    paths: stringArray(record.paths),
  };
}

export function normalizeCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeCollection)
    .filter((collection): collection is Collection => collection !== null);
}

/** Returns a new collection with the paths that are not already in it. */
export function addToCollection(collection: Collection, paths: string[]): Collection {
  const know = new Set(collection.paths);

  return {
    ...collection,
    paths: [...collection.paths, ...paths.filter(path => !know.has(path))],
  };
}

export function removeFromCollection(collection: Collection, paths: string[]): Collection {
  const remove = new Set(paths);
  return { ...collection, paths: collection.paths.filter(path => !remove.has(path)) };
}

/** Paths saved in the collection that are no longer in the library index. */
export function missingPaths(collection: Collection, known: Set<string>) {
  return collection.paths.filter(path => !known.has(path));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
