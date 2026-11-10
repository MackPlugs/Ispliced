import { describe, expect, it } from "vitest";
import { SpliceSample, SpliceSamplePack } from "../src/splice/api";
import { downloadSamples } from "../src/splice/downloadSamples";

const pack = (name: string): SpliceSamplePack => ({
  uuid: name,
  name,
  permalink_base_url: "",
  files: [],
});

const sample = (uuid: string, name: string, owner: SpliceSamplePack): SpliceSample => ({
  uuid,
  name,
  tags: [],
  files: [],
  parents: { items: [owner] },
  bpm: null,
  chord_type: null,
  duration: 1000,
  instrument: "drums",
  key: null,
  asset_category_slug: "loop",
});

describe("batch sample downloads", () => {
  it("writes each sample under its own pack", async () => {
    const saved: string[] = [];
    const result = await downloadSamples(
      [sample("1", "kick.wav", pack("Aventador")), sample("2", "arp.wav", pack("Neon Nights"))],
      async (_sample, path) => { saved.push(path); },
      () => {},
    );

    expect(result).toMatchObject({ saved: 2, failed: 0, found: 2 });
    expect(saved.sort()).toEqual([
      "Aventador/Drums/Loops/kick.wav",
      "Neon_Nights/Drums/Loops/arp.wav",
    ]);
  });

  it("suffixes samples that resolve to the same path", async () => {
    const owner = pack("Aventador");
    const saved: string[] = [];

    await downloadSamples(
      [sample("1", "kick.wav", owner), sample("2", "kick.wav", owner)],
      async (_sample, path) => { saved.push(path); },
      () => {},
    );

    expect(saved.sort()).toEqual([
      "Aventador/Drums/Loops/kick.wav",
      "Aventador/Drums/Loops/kick_1.wav",
    ]);
  });

  it("counts failures without aborting the batch", async () => {
    const owner = pack("Aventador");
    const result = await downloadSamples(
      [sample("1", "kick.wav", owner), sample("2", "arp.wav", owner)],
      async item => { if (item.uuid === "1") throw new Error("disk full"); },
      () => {},
    );

    expect(result).toMatchObject({ saved: 1, failed: 1, found: 2 });
    expect(result.errors[0]).toContain("disk full");
  });
});
