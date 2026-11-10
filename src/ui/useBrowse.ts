import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "@heroui/react";

import { errorMessage } from "../errors";
import { IN_TAURI } from "../native";
import { SpliceSample, SpliceSamplePack } from "../splice/api";
import { SpliceTag } from "../splice/entities";
import { loadSampleAudio } from "../splice/sampleAudio";
import { NavigationHistory } from "./history";
import { LoopMatch, splitKey, toleranceRange } from "./loopMatch";
import { usePlayer } from "./player";
import { neighbourIndex } from "./playlist";
import { packOf, trackOf } from "./sampleTrack";
import { SavedSearch } from "./savedSearch";
import { BrowseFilterState, useBrowseFilters } from "./useBrowseFilters";
import { useCatalogueSearch } from "./useCatalogueSearch";
import { useDownloads } from "./useDownloads";
import { useSampleSelection } from "./useSampleSelection";
import { useSavedSearches } from "./useSavedSearches";

const SEARCH_DEBOUNCE_MS = 250;
const RANDOM_SEED_LIMIT = 10_000_000_000;

type PackSearchState = BrowseFilterState & {
  page: number;
  randomSeed: string;
};

interface BrowseSnapshot extends PackSearchState {
  view: "samples" | "packs";
  packFilter: SpliceSamplePack | null;
  scrollTop: number;
  returnToPacks: PackSearchState | null;
}

export type BrowseController = ReturnType<typeof useBrowse>;

/**
 * Owns the browse screen: filters, catalogue results, saved searches, pack
 * navigation, history and result playback. `BrowseView` only renders it.
 */
export function useBrowse({ onOpenSettings }: { onOpenSettings: () => void }) {
  const player = usePlayer();
  const filters = useBrowseFilters();

  const [view, setView] = useState<"samples" | "packs">("samples");
  const [bpmOpen, setBpmOpen] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [packFilter, setPackFilter] = useState<SpliceSamplePack | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchRevision, setSearchRevision] = useState(0);

  const restoredPage = useRef<number | null>(null);
  const randomSeed = useRef("");
  const navigation = useRef(new NavigationHistory<BrowseSnapshot>());
  const [, refreshNavigation] = useState(0);
  const restoringHistory = useRef(false);
  const pendingScroll = useRef<number | null>(null);
  const resultContainer = useRef<HTMLDivElement | null>(null);

  const filterStateActive =
    filters.tags.length > 0 || filters.excludedTags.length > 0
    || filters.instruments.size > 0 || filters.genres.size > 0
    || filters.excludedInstruments.size > 0 || filters.excludedGenres.size > 0
    || filters.musicKey != null || filters.chordType != null
    || filters.bpm != null || filters.sampleType !== "any";
  const filtersActive = filterStateActive || packFilter != null;

  const search = useCatalogueSearch({
    view,
    sortBy: filters.sortBy,
    bpm: filters.bpm,
    bpmType: filters.bpmType,
    sampleType: filters.sampleType,
    instruments: filters.instruments,
    genres: filters.genres,
    excludedInstruments: filters.excludedInstruments,
    excludedGenres: filters.excludedGenres,
    tags: filters.tags,
    excludedTags: filters.excludedTags,
    musicKey: filters.musicKey,
    chordType: filters.chordType,
    packFilter,
    filtersActive: filterStateActive,
  });

  const selection = useSampleSelection();
  const saved = useSavedSearches();
  const downloads = useDownloads({ onMissingFolder: onOpenSettings });

  const queryText = filters.query;
  const { setSearchQuery } = filters;

  async function downloadSelected() {
    const chosen = search.results.filter(sample => selection.selectedSamples.has(sample.uuid));
    if (await downloads.downloadSelection(chosen)) selection.clear();
  }

  async function saveCurrentSearch(name: string) {
    await saved.save({
      name,
      view,
      query: filters.query,
      sortBy: filters.sortBy,
      bpm: filters.bpm ?? null,
      bpmType: filters.bpmType,
      sampleType: filters.sampleType,
      instruments: [...filters.instruments],
      genres: [...filters.genres],
      excludedInstruments: [...filters.excludedInstruments],
      excludedGenres: [...filters.excludedGenres],
      tags: filters.tags,
      excludedTags: filters.excludedTags,
      musicKey: filters.musicKey,
      chordType: filters.chordType,
      packFilter,
    });
  }

  function applySavedSearch(savedSearch: SavedSearch) {
    player.pause();
    filters.restore({
      query: savedSearch.query,
      searchQuery: savedSearch.query,
      sortBy: savedSearch.sortBy,
      bpm: savedSearch.bpm ?? undefined,
      bpmType: savedSearch.bpmType,
      sampleType: savedSearch.sampleType,
      instruments: new Set(savedSearch.instruments),
      genres: new Set(savedSearch.genres),
      excludedInstruments: new Set(savedSearch.excludedInstruments),
      excludedGenres: new Set(savedSearch.excludedGenres),
      tags: savedSearch.tags,
      excludedTags: savedSearch.excludedTags,
      excludeMode: false,
      musicKey: savedSearch.musicKey,
      chordType: savedSearch.chordType,
    });
    setView(savedSearch.view);
    setPackFilter(savedSearch.packFilter);
    setCurrentPage(1);
    refreshSearch();
  }

  function refreshSearch() {
    setSearchRevision(value => value + 1);
  }

  function changePage(page: number) {
    setCurrentPage(page);
    resultContainer.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  function loadMore() {
    setCurrentPage(page => page + 1);
  }

  function handleSearchInput(event: React.ChangeEvent<HTMLInputElement>) {
    // Invalidate pending responses immediately, before the debounce runs.
    search.beginSearch();
    filters.setQuery(event.target.value);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      filters.setSearchQuery(filters.query);
      refreshSearch();
    }
  }

  function handleTagClick(tag: SpliceTag) {
    if (!filters.tags.some(entry => entry.uuid === tag.uuid)) filters.toggleTag(tag);
  }

  function clearPackFilter() {
    setPackFilter(null);
    setCurrentPage(1);
  }

  function syncNavigation() {
    refreshNavigation(value => value + 1);
  }

  const packSearch = useRef<PackSearchState | null>(null);

  function captureBrowseState(page = currentPage): BrowseSnapshot {
    return {
      ...filters.snapshot(),
      page,
      randomSeed: randomSeed.current,
      view,
      packFilter,
      scrollTop: 0,
      returnToPacks: packSearch.current,
    };
  }

  function saveBrowseBeforeNavigation() {
    // Capture typed input too: a user can open a result before its debounce fires.
    const criteria = JSON.stringify([filters.criteriaKey(view), packFilter?.uuid]);
    const state = { ...captureBrowseState(), query: filters.query, scrollTop: resultContainer.current?.scrollTop ?? 0 };
    if (!navigation.current.push(JSON.stringify([criteria, currentPage]), state)) {
      navigation.current.update(state);
    }
    syncNavigation();
  }

  function rememberScroll() {
    const previous = navigation.current.current;
    if (previous && resultContainer.current) {
      navigation.current.update({ ...previous, scrollTop: resultContainer.current.scrollTop });
    }
  }

  function navigateHistory(direction: -1 | 1) {
    const previous = navigation.current.current;
    if (previous) {
      navigation.current.update({
        ...previous,
        scrollTop: resultContainer.current?.scrollTop ?? previous.scrollTop,
      });
    }

    const savedState = navigation.current.move(direction);
    if (savedState == null) return;

    search.invalidate();
    player.pause();
    restoringHistory.current = true;
    restoredPage.current = savedState.page;
    pendingScroll.current = savedState.scrollTop;
    randomSeed.current = savedState.randomSeed;
    packSearch.current = savedState.returnToPacks;
    filters.restore(savedState);
    setView(savedState.view);
    setPackFilter(savedState.packFilter);
    setCurrentPage(savedState.page);
    refreshSearch();
    syncNavigation();
  }

  function handlePackClick(pack: SpliceSamplePack) {
    saveBrowseBeforeNavigation();
    search.invalidate();
    player.pause();
    if (view === "packs") {
      packSearch.current = { ...filters.snapshot(), page: currentPage, randomSeed: randomSeed.current };
    }

    // A pack opens with every sample, rather than inheriting the discovery filters.
    filters.setQuery("");
    filters.setSearchQuery("");
    filters.setBpm(undefined);
    filters.setMusicKey(null);
    filters.setChordType(null);
    filters.setInstruments(new Set());
    filters.setGenres(new Set());
    filters.setTags([]);
    filters.setSampleType("any");
    filters.setExcludedTags([]);
    filters.setExcludedInstruments(new Set());
    filters.setExcludedGenres(new Set());
    filters.setExcludeMode(false);
    setPackFilter(pack);
    setCurrentPage(1);
    setView("samples");
    search.clearResults();
  }

  function showSamples() {
    saveBrowseBeforeNavigation();
    search.invalidate();
    player.pause();
    setView("samples");
  }

  function showPacks() {
    if (view === "packs") return;

    saveBrowseBeforeNavigation();
    search.invalidate();
    player.pause();
    setPackFilter(null);

    const savedState = packSearch.current;
    if (savedState != null) {
      filters.restore(savedState);
      restoredPage.current = savedState.page;
      randomSeed.current = savedState.randomSeed;
      setCurrentPage(savedState.page);
      packSearch.current = null;
    }
    setView("packs");
  }

  /** Applies a local loop's key and tempo, then shows the matching catalogue page. */
  function applyMatch(match: LoopMatch) {
    const { musicKey, chordType } = splitKey(match.key);
    filters.clear();
    setPackFilter(null);
    filters.setMusicKey(musicKey);
    filters.setChordType(chordType);
    filters.setSampleType("loop");

    if (match.bpm != null) {
      const range = toleranceRange(match.bpm, match.tolerance);
      filters.setBpmType("range");
      filters.setBpm(range);
    } else {
      filters.setBpm(undefined);
    }

    setView("samples");
    setCurrentPage(1);
    refreshSearch();
  }

  const currentResultIndex = search.results.findIndex(sample => sample.uuid === player.track?.uuid);

  async function playSample(sample: SpliceSample) {
    if (!IN_TAURI) return;

    try {
      const bytes = await loadSampleAudio(sample);
      await player.play(trackOf(sample, packOf(sample)), new Blob([bytes], { type: "audio/mpeg" }));
    } catch (error) {
      toast.danger("Could not play that sample", { description: errorMessage(error) });
    }
  }

  function playSibling(offset: -1 | 1) {
    const next = neighbourIndex(search.results.length, currentResultIndex, offset);
    if (next != null) void playSample(search.results[next]);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(queryText);
      setSearchRevision(value => value + 1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryText, setSearchQuery]);

  const previousCriteria = useRef("");
  useEffect(() => {
    const criteria = JSON.stringify([filters.criteriaKey(view), packFilter?.uuid]);
    const resetPage = previousCriteria.current !== criteria;
    previousCriteria.current = criteria;
    const restoring = restoredPage.current !== null;
    const page = restoredPage.current ?? (resetPage ? 1 : currentPage);
    restoredPage.current = null;

    if (resetPage && !restoring) {
      randomSeed.current = Math.floor(Math.random() * RANDOM_SEED_LIMIT).toString();
    }

    if (restoringHistory.current) {
      restoringHistory.current = false;
    } else {
      const previous = navigation.current.current;
      if (previous) {
        navigation.current.update({
          ...previous,
          scrollTop: resultContainer.current?.scrollTop ?? previous.scrollTop,
        });
      }
      const snapshot = captureBrowseState(page);
      if (navigation.current.push(JSON.stringify([criteria, page]), snapshot)) {
        pendingScroll.current = 0;
        syncNavigation();
      }
    }

    setCurrentPage(page);
    selection.clear();
    void search.updateSearch(filters.searchQuery, page, randomSeed.current)
      .then(applied => { if (applied) player.pause(); });

    // Invalidate any response still in flight when the search changes.
    return () => { search.invalidate(); };
    // The browse state above is part of the dependency list; the helpers
    // themselves only read that state for the current render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, filters.searchQuery, searchRevision, filters.sortBy, filters.bpm, filters.bpmType,
    filters.sampleType, filters.instruments, filters.genres, filters.excludedInstruments,
    filters.excludedGenres, filters.tags, filters.excludedTags, currentPage,
    filters.musicKey, filters.chordType, packFilter]);

  useLayoutEffect(() => {
    if (!search.loading && pendingScroll.current !== null && resultContainer.current) {
      resultContainer.current.scrollTop = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [search.results, search.packs, search.loading]);

  return {
    filters, search, selection, downloads,
    savedSearches: saved.savedSearches,
    view, packFilter, bpmOpen, tagsExpanded,
    currentPage, filtersActive,
    showResults: view === "packs" || filters.query.length > 0 || filtersActive,
    resultCount: view === "packs" ? search.packs.length : search.results.length,
    selectedCount: search.results.filter(sample => selection.selectedSamples.has(sample.uuid)).length,
    resultContainer,
    canGoBack: navigation.current.canBack,
    canGoForward: navigation.current.canForward,
    packSearchReturnable: packSearch.current != null,
    canPrevious: currentResultIndex > 0,
    canNext: currentResultIndex >= 0 && currentResultIndex < search.results.length - 1,
    setBpmOpen, setTagsExpanded,
    refreshSearch, changePage, loadMore, clearPackFilter,
    handleSearchInput, handleSearchKeyDown, handleTagClick,
    downloadSelected, saveCurrentSearch, applySavedSearch, removeSavedSearch: saved.remove,
    handlePackClick, showSamples, showPacks, navigateHistory, rememberScroll,
    playPrevious: () => playSibling(-1),
    playNext: () => playSibling(1),
    applyMatch,
  };
}
