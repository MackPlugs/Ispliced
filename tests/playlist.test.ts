import { describe, expect, it } from "vitest";
import { neighbourIndex } from "../src/ui/playlist";

describe("neighbouring results", () => {
  it("moves within the list", () => {
    expect(neighbourIndex(3, 0, 1)).toBe(1);
    expect(neighbourIndex(3, 2, -1)).toBe(1);
  });

  it("stops at both ends instead of wrapping", () => {
    expect(neighbourIndex(3, 0, -1)).toBeNull();
    expect(neighbourIndex(3, 2, 1)).toBeNull();
  });

  it("returns null when the current sample is not in the list", () => {
    expect(neighbourIndex(3, -1, 1)).toBeNull();
    expect(neighbourIndex(3, 3, -1)).toBeNull();
    expect(neighbourIndex(0, 0, 1)).toBeNull();
  });
});
