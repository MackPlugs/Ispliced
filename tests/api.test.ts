import { describe, expect, it } from "vitest";
import { createPackSearchRequest, createSearchRequest } from "../src/splice/api";

describe("catalogue queries", () => {
  it("requests the pack metadata shown on the cards", () => {
    const query = createPackSearchRequest("trap").query;

    expect(query).toContain("asset_type_slug: pack");
    expect(query).toContain("child_asset_counts");
    expect(query).toContain("main_genre");
    expect(query).toContain("provider");
  });

  it("searches samples by default", () => {
    expect(createSearchRequest("kick").query).toContain("asset_type_slug: sample");
  });
});
