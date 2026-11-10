import { describe, expect, it } from "vitest";
import { fractionOf, resumeFraction } from "../src/ui/playbackPosition";

describe("preview positions", () => {
  it("reads the fraction of the current track", () => {
    expect(fractionOf(5, 10)).toBe(0.5);
    expect(fractionOf(0, 10)).toBe(0);
  });

  it("falls back when metadata is not ready", () => {
    expect(fractionOf(0, Number.NaN, 0.25)).toBe(0.25);
    expect(fractionOf(0, 0, 0.4)).toBe(0.4);
  });

  it("clamps positions that run past the track", () => {
    expect(fractionOf(12, 10)).toBe(1);
  });

  it("restarts a track that reached the end", () => {
    expect(resumeFraction(0.999)).toBe(0);
    expect(resumeFraction(1)).toBe(0);
  });

  it("keeps a mid-track position", () => {
    expect(resumeFraction(0.42)).toBe(0.42);
    expect(resumeFraction(-1)).toBe(0);
    expect(resumeFraction(Number.NaN)).toBe(0);
  });
});
