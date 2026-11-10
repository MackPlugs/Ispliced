import { describe, expect, it } from "vitest";
import { duplicateCounts } from "../src/ui/libraryDuplicates";

describe("duplicate detection", () => {
  it("counts only hashes shared by at least two files", () => {
    const counts = duplicateCounts([
      { hash: "a" },
      { hash: "a" },
      { hash: "b" },
      { hash: null },
    ]);

    expect(counts.get("a")).toBe(2);
    expect(counts.has("b")).toBe(false);
    expect(counts.size).toBe(1);
  });

  it("is empty when nothing repeats", () => {
    expect(duplicateCounts([{ hash: "a" }, { hash: "b" }]).size).toBe(0);
  });
});
