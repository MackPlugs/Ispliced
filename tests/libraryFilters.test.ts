import { describe, expect, it } from "vitest";
import type { LibraryEntry } from "../src/native";
import {
  EMPTY_LIBRARY_FILTERS, filterLibrary, keyOrder, sortLibrary, uniqueKeys,
} from "../src/ui/libraryFilters";

function entry(overrides: Partial<LibraryEntry>): LibraryEntry {
  return {
    path: `C:/Samples/${overrides.name ?? "sample.wav"}`,
    name: "sample.wav",
    pack: "Pack",
    instrument: "Drums",
    kind: "loop",
    bpm: 120,
    key: "Cmaj",
    durationMs: 1000,
    bytes: 1,
    favorite: false,
    modified: 1,
    hash: null,
    embedding: null,
    ...overrides,
  };
}

const kick = entry({ name: "kick.wav", instrument: "Drums", key: "Cmaj", bpm: 120, hash: "a" });
const bass = entry({ name: "bass.wav", instrument: "Bass", key: "F#min", bpm: 90, hash: "b" });
const pad = entry({ name: "pad.wav", instrument: "Synth", key: null, bpm: null, kind: "one-shot" });
const kickCopy = entry({ name: "kick copy.wav", instrument: "Drums", key: "Cmaj", bpm: 120, hash: "a" });
const all = [kick, bass, pad, kickCopy];

describe("library filters", () => {
  it("ORs values inside a facet", () => {
    const result = filterLibrary(all, { ...EMPTY_LIBRARY_FILTERS, instruments: ["Drums", "Bass"] }, new Map());
    expect(result.map(entry => entry.name)).toEqual(["kick.wav", "bass.wav", "kick copy.wav"]);
  });

  it("ANDs facets together", () => {
    const result = filterLibrary(all, {
      ...EMPTY_LIBRARY_FILTERS,
      instruments: ["Drums"],
      keys: ["Cmaj"],
      bpmMin: 100,
      bpmMax: 130,
    }, new Map());

    expect(result).toHaveLength(2);
  });

  it("treats a missing BPM as out of range", () => {
    const result = filterLibrary(all, { ...EMPTY_LIBRARY_FILTERS, bpmMin: 100 }, new Map());
    expect(result.some(entry => entry.name === "pad.wav")).toBe(false);
  });

  it("keeps only files with duplicates", () => {
    const duplicates = new Map([["a", 2]]);
    const result = filterLibrary(all, { ...EMPTY_LIBRARY_FILTERS, duplicatesOnly: true }, duplicates);
    expect(result.map(entry => entry.name)).toEqual(["kick.wav", "kick copy.wav"]);
  });

  it("filters by kind", () => {
    const result = filterLibrary(all, { ...EMPTY_LIBRARY_FILTERS, kinds: ["one-shot"] }, new Map());
    expect(result.map(entry => entry.name)).toEqual(["pad.wav"]);
  });
});

describe("library sorting", () => {
  it("sorts numbers descending", () => {
    const sorted = sortLibrary(all, { column: "bpm", direction: "desc" });
    expect(sorted.map(entry => entry.bpm)).toEqual([120, 120, 90, null]);
  });

  it("keeps missing values last when ascending", () => {
    const sorted = sortLibrary(all, { column: "key", direction: "asc" });
    expect(sorted.at(-1)?.key).toBeNull();
    expect(sorted[0].key).toBe("Cmaj");
  });
});

describe("key ordering", () => {
  it("orders by tonic and then mode", () => {
    expect(keyOrder("Cmaj") < keyOrder("F#min")).toBe(true);
    expect(keyOrder("Cmaj") < keyOrder("Cmin")).toBe(true);
    expect(uniqueKeys([bass, kick])).toEqual(["Cmaj", "F#min"]);
  });
});
