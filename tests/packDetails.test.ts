import { describe, expect, it } from "vitest";
import { SpliceSamplePack } from "../src/splice/api";
import { packDetails } from "../src/ui/packDetails";

const pack = (overrides: Partial<SpliceSamplePack> = {}): SpliceSamplePack => ({
  uuid: "pack",
  name: "Aventador",
  permalink_base_url: "mock",
  files: [],
  ...overrides,
});

describe("pack details", () => {
  it("lists the sample count, provider and genre", () => {
    const details = packDetails(pack({
      child_asset_counts: [{ type: "sample", count: 128 }, { type: "preset", count: 12 }],
      provider: { name: "Cymatics" },
      main_genre: "Trap",
    }));

    expect(details).toBe("128 samples · Cymatics · Trap");
  });

  it("omits parts the pack does not carry", () => {
    expect(packDetails(pack({ provider: { name: "Cymatics" } }))).toBe("Cymatics");
    expect(packDetails(pack({ child_asset_counts: [{ type: "preset", count: 4 }] }))).toBe("");
  });

  it("matches the count type case-insensitively", () => {
    expect(packDetails(pack({ child_asset_counts: [{ type: "Samples", count: 12 }] })))
      .toBe("12 samples");
  });
});
