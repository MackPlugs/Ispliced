import type { LibraryEntry } from "../native";
import { filterEntries } from "./librarySearch";

export type LibrarySortColumn =
  | "name" | "pack" | "instrument" | "kind" | "key" | "bpm" | "durationMs" | "modified";

export type SortDirection = "asc" | "desc";

export type LibrarySort = {
  column: LibrarySortColumn;
  direction: SortDirection;
};

export type LibraryFilters = {
  query: string;
  favoritesOnly: boolean;
  duplicatesOnly: boolean;
  instruments: string[];
  kinds: LibraryEntry["kind"][];
  keys: string[];
  bpmMin: number | null;
  bpmMax: number | null;
};

export const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  query: "",
  favoritesOnly: false,
  duplicatesOnly: false,
  instruments: [],
  kinds: [],
  keys: [],
  bpmMin: null,
  bpmMax: null,
};

export const DEFAULT_LIBRARY_SORT: LibrarySort = { column: "name", direction: "asc" };

/**
 * Filters the index. Values inside one facet are ORed and facets are ANDed, so
 * "drums or bass, in C minor, at 120 BPM" reads the way a user expects.
 */
export function filterLibrary(
  entries: LibraryEntry[],
  filters: LibraryFilters,
  duplicates: Map<string, number>,
): LibraryEntry[] {
  return filterEntries(entries, filters.query, filters.favoritesOnly).filter(entry => {
    if (filters.duplicatesOnly && !isDuplicate(entry, duplicates)) return false;
    if (filters.instruments.length && !filters.instruments.includes(entry.instrument)) return false;
    if (filters.kinds.length && !filters.kinds.includes(entry.kind)) return false;
    if (filters.keys.length && (entry.key == null || !filters.keys.includes(entry.key))) return false;
    return inBpmRange(entry.bpm, filters.bpmMin, filters.bpmMax);
  });
}

function isDuplicate(entry: LibraryEntry, duplicates: Map<string, number>) {
  return entry.hash != null && (duplicates.get(entry.hash) ?? 0) > 1;
}

function inBpmRange(bpm: number | null, min: number | null, max: number | null) {
  if (min == null && max == null) return true;
  if (bpm == null) return false;

  return (min == null || bpm >= min) && (max == null || bpm <= max);
}

/** Sorts a copy; missing values stay last in both directions. */
export function sortLibrary(entries: LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...entries].sort((left, right) => {
    const a = sortValue(left, sort.column);
    const b = sortValue(right, sort.column);
    const aMissing = a == null || a === "";
    const bMissing = b == null || b === "";

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    const order = typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
    return order * factor;
  });
}

function sortValue(entry: LibraryEntry, column: LibrarySortColumn): string | number | null {
  switch (column) {
    case "key": return entry.key == null ? null : keyOrder(entry.key);
    case "bpm": return entry.bpm;
    case "durationMs": return entry.durationMs;
    case "modified": return entry.modified;
    case "kind": return entry.kind;
    default: return entry[column];
  }
}

/** Musical order: C, C#, D … B, with major before minor. */
export function keyOrder(key: string) {
  const match = /^([A-G])([#b]?)(.*)$/.exec(key);
  if (match == null) return `99:${key}`;

  const semitone = (NOTES.indexOf(match[1]) + accidental(match[2]) + 12) % 12;
  const mode = match[3].startsWith("min") ? 1 : 0;
  return `${String(semitone).padStart(2, "0")}:${mode}:${match[3]}`;
}

const NOTES = ["C", "D", "E", "F", "G", "A", "B"];

function accidental(value: string) {
  if (value === "#") return 1;
  if (value === "b") return -1;
  return 0;
}

export function uniqueInstruments(entries: LibraryEntry[]) {
  return unique(entries.map(entry => entry.instrument)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function uniqueKeys(entries: LibraryEntry[]) {
  return unique(entries.map(entry => entry.key)).sort((a, b) => keyOrder(a).localeCompare(keyOrder(b)));
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value != null && value !== ""))];
}
