import { describe, expect, it } from "vitest";
import { clampBpm, tempoRate } from "../src/ui/tempo";

describe("tempo lock", () => {
  it("plays unmodified when unlocked or the sample has no BPM", () => {
    expect(tempoRate(128, 120, false)).toBe(1);
    expect(tempoRate(null, 120, true)).toBe(1);
    expect(tempoRate(128, 0, true)).toBe(1);
  });

  it("speeds a slow loop up and slows a fast one down", () => {
    expect(tempoRate(100, 120, true)).toBeCloseTo(120 / 100);
    expect(tempoRate(140, 120, true)).toBeCloseTo(120 / 140);
  });

  it("clamps extreme ratios", () => {
    expect(tempoRate(40, 240, true)).toBe(2);
    expect(tempoRate(240, 40, true)).toBe(0.5);
  });

  it("clamps a typed target BPM", () => {
    expect(clampBpm(10)).toBe(40);
    expect(clampBpm(300)).toBe(240);
    expect(clampBpm(Number.NaN)).toBe(40);
    expect(clampBpm(128.4)).toBe(128);
  });
});
