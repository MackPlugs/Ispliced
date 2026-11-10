import { describe, expect, it } from "vitest";
import { isSupportedLoopFile, splitKey, toleranceRange } from "../src/ui/loopMatch";

describe("loop match", () => {
  it("builds an exact window", () => {
    expect(toleranceRange(128, "exact")).toEqual({ minBpm: 128, maxBpm: 128 });
  });

  it("widens the window for near matches", () => {
    expect(toleranceRange(128, "near")).toEqual({ minBpm: 126, maxBpm: 130 });
  });

  it("halves and doubles the tempo", () => {
    expect(toleranceRange(140, "half")).toEqual({ minBpm: 68, maxBpm: 72 });
    expect(toleranceRange(70, "double")).toEqual({ minBpm: 138, maxBpm: 142 });
  });

  it("clamps to the supported range", () => {
    expect(toleranceRange(2, "half")).toEqual({ minBpm: 1, maxBpm: 3 });
    expect(toleranceRange(290, "double")).toEqual({ minBpm: 300, maxBpm: 300 });
  });

  it("splits a detected key into catalogue fields", () => {
    expect(splitKey("F#min")).toEqual({ musicKey: "F#", chordType: "minor" });
    expect(splitKey("Cmaj")).toEqual({ musicKey: "C", chordType: "major" });
    expect(splitKey("Bbmin")).toEqual({ musicKey: "A#", chordType: "minor" });
  });

  it("leaves unknown or missing keys empty", () => {
    expect(splitKey(null)).toEqual({ musicKey: null, chordType: null });
    expect(splitKey("Dorian")).toEqual({ musicKey: null, chordType: null });
  });

  it("only accepts files local analysis can read", () => {
    expect(isSupportedLoopFile("C:/loops/kick.wav")).toBe(true);
    expect(isSupportedLoopFile("C:\\loops\\kick.WAV")).toBe(true);
    expect(isSupportedLoopFile("C:/loops/kick.aiff")).toBe(false);
    expect(isSupportedLoopFile("C:/loops/kick.mp3")).toBe(false);
    expect(isSupportedLoopFile("C:/loops/kick")).toBe(false);
  });
});
