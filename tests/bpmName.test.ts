import { describe, expect, it } from "vitest";
import { parseBpmFromName } from "../src/ui/bpmName";

describe("BPM from a sample name", () => {
  it("prefers an explicit BPM marker", () => {
    expect(parseBpmFromName("kick 128 BPM.wav")).toBe(128);
    expect(parseBpmFromName("kick_90bpm.wav")).toBe(90);
    expect(parseBpmFromName("Kick - 128 BPM - vinyl.wav")).toBe(128);
  });

  it("rejects an out-of-range explicit marker", () => {
    expect(parseBpmFromName("loop 999 bpm.wav")).toBeNull();
  });

  it("reads the bare token Splice names use", () => {
    expect(parseBpmFromName("STCR2_DMDH_125_Vocal_YouGotMe_Gm.wav")).toBe(125);
    expect(parseBpmFromName("NW_PTCR_150_vocal_loop_KnowWhy_Gm.wav")).toBe(150);
    expect(parseBpmFromName("Pack/Drums/Loops/CJD_174_break_loop_chopped.wav")).toBe(174);
  });

  it("ignores 808s, years and short tokens", () => {
    expect(parseBpmFromName("808_kit_hit.wav")).toBeNull();
    expect(parseBpmFromName("loop_2020.wav")).toBeNull();
    expect(parseBpmFromName("take_5_loop.wav")).toBeNull();
  });

  it("only considers the file name, not the folders", () => {
    expect(parseBpmFromName("Pack 128/Drums/kick.wav")).toBeNull();
  });
});
