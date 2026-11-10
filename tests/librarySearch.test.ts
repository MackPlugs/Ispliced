import { describe, expect, it } from "vitest";
import { SearchableEntry, filterEntries } from "../src/ui/librarySearch";

const entry = (overrides: Partial<SearchableEntry> = {}): SearchableEntry => ({
  name: "kick 128 BPM.wav",
  pack: "Pack",
  instrument: "Drums",
  kind: "loop",
  key: "Amin",
  favorite: false,
  ...overrides,
});

describe("library search", () => {
  it("returns everything for a blank query", () => {
    expect(filterEntries([entry(), entry({ name: "snare.wav" })], "   ")).toHaveLength(2);
  });

  it("matches name, pack, instrument, key and kind", () => {
    const entries = [entry(), entry({ name: "snare.wav", key: null, kind: "one-shot" })];

    expect(filterEntries(entries, "kick")).toHaveLength(1);
    expect(filterEntries(entries, "pack")).toHaveLength(2);
    expect(filterEntries(entries, "amin")).toHaveLength(1);
    expect(filterEntries(entries, "one-shot")).toHaveLength(1);
  });

  it("ignores case and surrounding spaces", () => {
    expect(filterEntries([entry()], "  KICK  ")).toHaveLength(1);
  });

  it("can restrict results to favourites", () => {
    const entries = [entry({ favorite: true }), entry({ name: "snare.wav" })];

    expect(filterEntries(entries, "", true)).toHaveLength(1);
    expect(filterEntries(entries, "snare", true)).toHaveLength(0);
  });
});
