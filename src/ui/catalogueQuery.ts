import type { BpmFilter, BpmFilterType } from "./bpm";
import type { ChordType, MusicKey, SpliceSampleType, SpliceSortBy, SpliceTag } from "../splice/entities";
import {
  SpliceSample, SpliceSamplePack, SpliceSearchRequest, SpliceSearchResponse,
  createPackSearchRequest, createSearchRequest,
} from "../splice/api";

export type CatalogueFilters = {
  view: "samples" | "packs";
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
  musicKey: MusicKey | null;
  chordType: ChordType | null;
  packFilter: SpliceSamplePack | null;
  filtersActive: boolean;
};

export type Constraint = { name: string; uuid: string };

export type SearchPage = SpliceSearchResponse<SpliceSample | SpliceSamplePack>["data"]["assetsSearch"];

/** The GraphQL variables for the current filters. */
export function buildSearchPayload(
  filters: CatalogueFilters,
  query: string,
  page: number,
  randomSeed: string,
): SpliceSearchRequest {
  const payload = filters.view === "packs" ? createPackSearchRequest(query) : createSearchRequest(query);
  const variables = payload.variables;

  variables.sort = filters.sortBy;
  if (filters.sortBy === "random") variables.random_seed = randomSeed;

  variables.tags = filters.tags.map(tag => tag.uuid);
  variables.tags_exclude = filters.excludedTags.map(tag => tag.uuid);

  if (filters.bpmType === "exact") {
    variables.bpm = filters.bpm?.bpm;
  } else {
    variables.min_bpm = filters.bpm?.minBpm;
    variables.max_bpm = filters.bpm?.maxBpm;
  }

  if (filters.sampleType !== "any") variables.asset_category_slug = filters.sampleType;

  variables.tags.push(...filters.instruments, ...filters.genres);
  variables.tags_exclude.push(...filters.excludedInstruments, ...filters.excludedGenres);

  variables.chord_type = filters.chordType ?? undefined;
  variables.key = filters.musicKey ?? undefined;

  if (filters.packFilter != null) {
    variables.parent_asset_uuid = filters.packFilter.uuid;
    variables.parent_asset_type = "pack";
  }

  variables.page = page;
  return payload;
}

export function constraintsOf(data: SearchPage, name: "Genre" | "Instrument"): Constraint[] {
  return data.tag_summary
    .map(entry => entry.tag)
    .filter(tag => tag.taxonomy.name === name)
    .map(tag => ({ name: tag.label, uuid: tag.uuid }));
}
