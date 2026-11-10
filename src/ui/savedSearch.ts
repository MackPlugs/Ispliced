import { SpliceSamplePack } from "../splice/api";
import { ChordType, MusicKey, SpliceSampleType, SpliceSortBy, SpliceTag } from "../splice/entities";
import type { BpmFilter, BpmFilterType } from "./bpm";

/** A named browse state that can be restored later. */
export type SavedSearch = {
  id: string;
  name: string;
  view: "samples" | "packs";
  query: string;
  sortBy: SpliceSortBy;
  bpm: BpmFilter | null;
  bpmType: BpmFilterType;
  sampleType: SpliceSampleType | "any";
  instruments: string[];
  genres: string[];
  excludedInstruments: string[];
  excludedGenres: string[];
  tags: SpliceTag[];
  excludedTags: SpliceTag[];
  musicKey: MusicKey | null;
  chordType: ChordType | null;
  packFilter: SpliceSamplePack | null;
};

const SORT_OPTIONS: SpliceSortBy[] = ["relevance", "popularity", "recency", "random"];

/** Reads one stored search defensively so a stale or hand-edited file cannot break the UI. */
export function normalizeSearch(value: unknown): SavedSearch | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;

  return {
    id: record.id,
    name: record.name,
    view: record.view === "packs" ? "packs" : "samples",
    query: typeof record.query === "string" ? record.query : "",
    sortBy: SORT_OPTIONS.includes(record.sortBy as SpliceSortBy) ? record.sortBy as SpliceSortBy : "relevance",
    bpm: typeof record.bpm === "object" ? record.bpm as BpmFilter : null,
    bpmType: record.bpmType === "range" ? "range" : "exact",
    sampleType: record.sampleType === "loop" || record.sampleType === "oneshot"
      ? record.sampleType
      : "any",
    instruments: stringArray(record.instruments),
    genres: stringArray(record.genres),
    excludedInstruments: stringArray(record.excludedInstruments),
    excludedGenres: stringArray(record.excludedGenres),
    tags: tagArray(record.tags),
    excludedTags: tagArray(record.excludedTags),
    musicKey: typeof record.musicKey === "string" ? record.musicKey as MusicKey : null,
    chordType: record.chordType === "major" || record.chordType === "minor" ? record.chordType : null,
    packFilter: typeof record.packFilter === "object" ? record.packFilter as SpliceSamplePack : null,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function tagArray(value: unknown): SpliceTag[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is SpliceTag =>
    typeof item === "object" && item !== null
    && typeof (item as SpliceTag).uuid === "string"
    && typeof (item as SpliceTag).label === "string");
}
