import { useRef, useState } from "react";

import { SpliceSample, SpliceSamplePack, SpliceSearchRequest, createSearchRequest } from "../splice/api";
import { SpliceTag } from "../splice/entities";
import { findMatchingPacks, PackSearchCache, readSearchResponse } from "../splice/packs";
import { spliceSearch } from "../splice/searchClient";
import { errorMessage } from "../errors";
import {
  CatalogueFilters, Constraint, SearchPage, buildSearchPayload, constraintsOf,
} from "./catalogueQuery";

const RESPONSE_CACHE_LIMIT = 64;

/** Runs catalogue searches, reusing responses and the pack discovery cache. */
export function useCatalogueSearch(filters: CatalogueFilters) {
  const [results, setResults] = useState<SpliceSample[]>([]);
  const [packs, setPacks] = useState<SpliceSamplePack[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knownTags, setKnownTags] = useState<SpliceTag[]>([]);
  const [knownInstruments, setKnownInstruments] = useState<Constraint[]>([]);
  const [knownGenres, setKnownGenres] = useState<Constraint[]>([]);

  const sequence = useRef(0);
  const responseCache = useRef(new Map<string, string>());
  const pendingRequests = useRef(new Map<string, Promise<string>>());
  const facetsCache = useRef<SearchPage | null>(null);
  const matchingPacksCache = useRef<PackSearchCache>(new Map());

  function invalidate() {
    sequence.current++;
  }

  /** Invalidates in-flight work and shows the spinner while typing waits for the debounce. */
  function beginSearch() {
    invalidate();
    setLoading(true);
  }

  function clearResults() {
    setResults([]);
    setPacks([]);
    setTotalPages(0);
  }

  function cachedSearch(body: string): Promise<string> {
    const cached = responseCache.current.get(body);
    if (cached) return Promise.resolve(cached);

    const pending = pendingRequests.current.get(body);
    if (pending) return pending;

    const request = spliceSearch(body).then(raw => {
      readSearchResponse(raw); // Do not retain failed GraphQL responses.
      responseCache.current.set(body, raw);
      if (responseCache.current.size > RESPONSE_CACHE_LIMIT) {
        responseCache.current.delete(responseCache.current.keys().next().value!);
      }
      return raw;
    }).finally(() => pendingRequests.current.delete(body));

    pendingRequests.current.set(body, request);
    return request;
  }

  async function loadPage(payload: SpliceSearchRequest, isCurrent: () => boolean) {
    if (filters.view === "packs" && filters.filtersActive) {
      return findMatchingPacks(payload, cachedSearch, isCurrent, matchingPacksCache.current);
    }

    const raw = await cachedSearch(JSON.stringify(payload));
    const data = filters.view === "packs"
      ? readSearchResponse<SpliceSamplePack>(raw)
      : readSearchResponse<SpliceSample>(raw);
    if (!isCurrent()) return null;

    if (filters.view === "samples" && !facetsCache.current) facetsCache.current = data;
    return data;
  }

  /** Packs show facet counts from an unfiltered sample search, not from their own page. */
  async function facetsFor(data: SearchPage, isCurrent: () => boolean) {
    if (filters.view !== "packs" || filters.filtersActive) return data;

    if (!facetsCache.current) {
      const raw = await cachedSearch(JSON.stringify(createSearchRequest("")));
      if (!isCurrent()) return null;
      facetsCache.current = readSearchResponse(raw);
    }
    return facetsCache.current;
  }

  function applyPage(data: SearchPage) {
    setTotalPages(data.pagination_metadata.totalPages);
    if (filters.view === "packs") setPacks(data.items as SpliceSamplePack[]);
    else setResults(data.items as SpliceSample[]);
  }

  function applyFacets(data: SearchPage) {
    setKnownGenres(constraintsOf(data, "Genre"));
    setKnownInstruments(constraintsOf(data, "Instrument"));

    const seen = new Set<string>();
    setKnownTags(
      [...data.tag_summary].sort((left, right) => right.count - left.count)
        .map(entry => entry.tag)
        .filter(tag => !seen.has(tag.uuid) && (seen.add(tag.uuid), true))
        .map(tag => ({ uuid: tag.uuid, label: tag.label })),
    );
  }

  /** Resolves `true` when this response was the latest one and reached the UI. */
  async function updateSearch(query: string, page: number, randomSeed: string): Promise<boolean> {
    const run = ++sequence.current;
    const isCurrent = () => run === sequence.current;
    const payload = buildSearchPayload(filters, query, page, randomSeed);

    setLoading(true);
    setError(null);
    try {
      const data = await loadPage(payload, isCurrent);
      if (data == null || !isCurrent()) return false;
      applyPage(data);

      const facets = await facetsFor(data, isCurrent);
      if (facets == null || !isCurrent()) return false;
      applyFacets(facets);
      return true;
    } catch (err) {
      if (isCurrent()) setError(errorMessage(err));
      return false;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }

  return {
    results, packs, totalPages, loading, error,
    knownTags, knownInstruments, knownGenres,
    updateSearch, invalidate, beginSearch, clearResults,
  };
}
