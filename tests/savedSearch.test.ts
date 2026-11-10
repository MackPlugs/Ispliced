import { describe, expect, it } from "vitest";
import { normalizeSearch } from "../src/ui/savedSearch";

describe("saved search normalisation", () => {
  it("keeps a well-formed entry", () => {
    const search = normalizeSearch({
      id: "1",
      name: "Trap drums",
      view: "packs",
      query: "trap",
      sortBy: "recency",
      bpm: { minBpm: 120 },
      bpmType: "range",
      sampleType: "loop",
      instruments: ["drums"],
      genres: ["trap"],
      tags: [{ uuid: "a", label: "Drums" }],
      excludedTags: [{ uuid: "b", label: "808" }],
      musicKey: "C",
      chordType: "minor",
      packFilter: null,
    });

    expect(search).toMatchObject({
      id: "1",
      name: "Trap drums",
      view: "packs",
      sortBy: "recency",
      sampleType: "loop",
      instruments: ["drums"],
      tags: [{ uuid: "a", label: "Drums" }],
      excludedTags: [{ uuid: "b", label: "808" }],
    });
  });

  it("fills defaults for fields an older file may not have", () => {
    const search = normalizeSearch({ id: "2", name: "Old", query: "piano" });

    expect(search).toMatchObject({
      view: "samples",
      sortBy: "relevance",
      bpmType: "exact",
      sampleType: "any",
      instruments: [],
      genres: [],
      excludedInstruments: [],
      excludedGenres: [],
      tags: [],
      excludedTags: [],
      musicKey: null,
      chordType: null,
      packFilter: null,
    });
  });

  it("drops entries without an id or name", () => {
    expect(normalizeSearch({ name: "No id" })).toBeNull();
    expect(normalizeSearch({ id: "3" })).toBeNull();
    expect(normalizeSearch("nope")).toBeNull();
    expect(normalizeSearch(null)).toBeNull();
  });
});
