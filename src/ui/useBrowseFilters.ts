import { useCallback, useState } from "react";

import type { BpmFilter, BpmFilterType } from "./bpm";
import type { ChordType, MusicKey, SpliceSampleType, SpliceSortBy, SpliceTag } from "../splice/entities";

/** The filter half of a browse state; results and pagination live elsewhere. */
export type BrowseFilterState = {
  query: string;
  searchQuery: string;
  sortBy: SpliceSortBy;
  bpm: BpmFilter | undefined;
  bpmType: BpmFilterType;
  sampleType: SpliceSampleType | "any";
  instruments: Set<string>;
  genres: Set<string>;
  excludedInstruments: Set<string>;
  excludedGenres: Set<string>;
  tags: SpliceTag[];
  excludedTags: SpliceTag[];
  excludeMode: boolean;
  musicKey: MusicKey | null;
  chordType: ChordType | null;
};

const EMPTY: Omit<BrowseFilterState, "query" | "searchQuery"> = {
  sortBy: "popularity",
  bpm: undefined,
  bpmType: "exact",
  sampleType: "any",
  instruments: new Set(),
  genres: new Set(),
  excludedInstruments: new Set(),
  excludedGenres: new Set(),
  tags: [],
  excludedTags: [],
  excludeMode: false,
  musicKey: null,
  chordType: null,
};

/** Owns the browse filters, so App only composes the views that use them. */
export function useBrowseFilters() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SpliceSortBy>(EMPTY.sortBy);
  const [bpm, setBpm] = useState<BpmFilter>();
  const [bpmType, setBpmType] = useState<BpmFilterType>(EMPTY.bpmType);
  const [sampleType, setSampleType] = useState<SpliceSampleType | "any">("any");
  const [instruments, setInstruments] = useState(new Set<string>());
  const [genres, setGenres] = useState(new Set<string>());
  const [excludedInstruments, setExcludedInstruments] = useState(new Set<string>());
  const [excludedGenres, setExcludedGenres] = useState(new Set<string>());
  const [tags, setTags] = useState<SpliceTag[]>([]);
  const [excludedTags, setExcludedTags] = useState<SpliceTag[]>([]);
  const [excludeMode, setExcludeMode] = useState(false);
  const [musicKey, setMusicKey] = useState<MusicKey | null>(null);
  const [chordType, setChordType] = useState<ChordType | null>(null);

  const filtersActive =
    tags.length > 0 || excludedTags.length > 0
    || instruments.size > 0 || genres.size > 0
    || excludedInstruments.size > 0 || excludedGenres.size > 0
    || musicKey != null || chordType != null || bpm != null || sampleType != "any";

  /** A stable key that changes whenever a filter would change the results. */
  const criteriaKey = useCallback((view: "samples" | "packs") => JSON.stringify([
    view, searchQuery, sortBy, bpm, bpmType, sampleType,
    [...instruments], [...genres], [...excludedInstruments], [...excludedGenres],
    tags, excludedTags, musicKey, chordType,
  ]), [searchQuery, sortBy, bpm, bpmType, sampleType, instruments, genres,
    excludedInstruments, excludedGenres, tags, excludedTags, musicKey, chordType]);

  const snapshot = useCallback((): BrowseFilterState => ({
    query, searchQuery, sortBy, bpm, bpmType, sampleType,
    instruments, genres, excludedInstruments, excludedGenres,
    tags, excludedTags, excludeMode, musicKey, chordType,
  }), [query, searchQuery, sortBy, bpm, bpmType, sampleType,
    instruments, genres, excludedInstruments, excludedGenres,
    tags, excludedTags, excludeMode, musicKey, chordType]);

  const restore = useCallback((state: BrowseFilterState) => {
    setQuery(state.query);
    setSearchQuery(state.searchQuery);
    setSortBy(state.sortBy);
    setBpm(state.bpm);
    setBpmType(state.bpmType);
    setSampleType(state.sampleType);
    setInstruments(state.instruments);
    setGenres(state.genres);
    setExcludedInstruments(state.excludedInstruments);
    setExcludedGenres(state.excludedGenres);
    setTags(state.tags);
    setExcludedTags(state.excludedTags);
    setExcludeMode(state.excludeMode);
    setMusicKey(state.musicKey);
    setChordType(state.chordType);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setSearchQuery("");
    setTags([]);
    setExcludedTags([]);
    setInstruments(new Set());
    setGenres(new Set());
    setExcludedInstruments(new Set());
    setExcludedGenres(new Set());
    setMusicKey(null);
    setChordType(null);
    setBpm(undefined);
    setBpmType(EMPTY.bpmType);
    setSampleType("any");
  }, []);

  function toggleTag(tag: SpliceTag) {
    setExcludedTags(current => current.filter(entry => entry.uuid != tag.uuid));
    setTags(current => current.some(entry => entry.uuid == tag.uuid)
      ? current.filter(entry => entry.uuid != tag.uuid)
      : [...current, tag]);
  }

  function toggleExcludedTag(tag: SpliceTag) {
    setTags(current => current.filter(entry => entry.uuid != tag.uuid));
    setExcludedTags(current => current.some(entry => entry.uuid == tag.uuid)
      ? current.filter(entry => entry.uuid != tag.uuid)
      : [...current, tag]);
  }

  return {
    query, setQuery,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    bpm, setBpm,
    bpmType, setBpmType,
    sampleType, setSampleType,
    instruments, setInstruments,
    genres, setGenres,
    excludedInstruments, setExcludedInstruments,
    excludedGenres, setExcludedGenres,
    tags, setTags,
    excludedTags, setExcludedTags,
    excludeMode, setExcludeMode,
    musicKey, setMusicKey,
    chordType, setChordType,
    filtersActive, criteriaKey, snapshot, restore, clear,
    toggleTag, toggleExcludedTag,
  };
}
