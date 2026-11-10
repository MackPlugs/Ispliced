import { describe, expect, it } from "vitest";
import { CatalogueFilters, buildSearchPayload } from "../src/ui/catalogueQuery";

const base: CatalogueFilters = {
  view: "samples",
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
  musicKey: null,
  chordType: null,
  packFilter: null,
  filtersActive: false,
};

describe("catalogue search variables", () => {
  it("sends included and excluded facets as tag ids", () => {
    const payload = buildSearchPayload({
      ...base,
      instruments: new Set(["i1"]),
      genres: new Set(["g1"]),
      excludedInstruments: new Set(["i2"]),
      excludedGenres: new Set(["g2"]),
      tags: [{ uuid: "t1", label: "warm" }],
      excludedTags: [{ uuid: "t2", label: "harsh" }],
    }, "", 1, "42");

    expect(payload.variables.tags).toEqual(["t1", "i1", "g1"]);
    expect(payload.variables.tags_exclude).toEqual(["t2", "i2", "g2"]);
  });

  it("switches between exact and range tempo", () => {
    const exact = buildSearchPayload({ ...base, bpm: { bpm: "128" } }, "", 1, "42");
    expect(exact.variables.bpm).toBe("128");
    expect(exact.variables.min_bpm).toBeUndefined();

    const range = buildSearchPayload({
      ...base,
      bpmType: "range",
      bpm: { minBpm: 126, maxBpm: 130 },
    }, "", 1, "42");
    expect(range.variables.min_bpm).toBe(126);
    expect(range.variables.max_bpm).toBe(130);
    expect(range.variables.bpm).toBeUndefined();
  });

  it("passes the random seed only for random sorting", () => {
    expect(buildSearchPayload(base, "", 1, "42").variables.random_seed).toBeUndefined();
    expect(buildSearchPayload({ ...base, sortBy: "random" }, "", 1, "42").variables.random_seed).toBe("42");
  });

  it("narrows to a pack and to loops", () => {
    const payload = buildSearchPayload({
      ...base,
      sampleType: "loop",
      packFilter: { uuid: "pack-1", name: "Pack", permalink_base_url: "", files: [] },
    }, "", 2, "42");

    expect(payload.variables.parent_asset_uuid).toBe("pack-1");
    expect(payload.variables.parent_asset_type).toBe("pack");
    expect(payload.variables.asset_category_slug).toBe("loop");
    expect(payload.variables.page).toBe(2);
  });

  it("uses the pack catalogue when browsing packs", () => {
    expect(buildSearchPayload({ ...base, view: "packs" }, "", 1, "42").query)
      .toContain("asset_type_slug: pack");
  });
});
