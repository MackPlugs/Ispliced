import { describe, expect, it } from "vitest";
import { SpliceSample, SpliceSamplePack } from "../src/splice/api";
import { samplePath } from "../src/splice/samplePath";

const pack: SpliceSamplePack = {
  uuid: "pack",
  name: "Aventador",
  permalink_base_url: "",
  files: [],
};

function makeSample(overrides: Partial<SpliceSample> = {}): SpliceSample {
  return {
    uuid: "sample",
    name: "kick_01.wav",
    tags: [],
    files: [],
    parents: { items: [] },
    bpm: null,
    chord_type: null,
    duration: 1000,
    instrument: "drums",
    key: null,
    asset_category_slug: "loop",
    ...overrides,
  };
}

describe("download layout", () => {
  it("groups loops and one-shots under the pack and instrument", () => {
    expect(samplePath(pack, makeSample())).toBe("Aventador/Drums/Loops/kick_01.wav");
    expect(samplePath(pack, makeSample({ asset_category_slug: "oneshot" })))
      .toBe("Aventador/Drums/One-Shots/kick_01.wav");
  });

  it("uses the sample's own folder when no instrument is set", () => {
    const nested = makeSample({ name: "Bass/kick_01.wav", instrument: null });
    expect(samplePath(pack, nested)).toBe("Aventador/Bass/Loops/kick_01.wav");
  });

  it("falls back to Other when the only folder names the loop type", () => {
    const unnamed = makeSample({ name: "Loops/kick_01.wav", instrument: null });
    expect(samplePath(pack, unnamed)).toBe("Aventador/Other/Loops/kick_01.wav");
  });

  it("drops the classification for the long-path fallback", () => {
    expect(samplePath(pack, makeSample(), "pack")).toBe("Aventador/kick_01.wav");
  });
});
