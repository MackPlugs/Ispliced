import { SpliceSample, SpliceSamplePack } from "../splice/api";
import { parseBpmFromName } from "./bpmName";
import { PlayingTrack } from "./player";

/** The pack a catalogue sample belongs to. */
export function packOf(sample: SpliceSample): SpliceSamplePack {
  return sample.parents.items[0];
}

/**
 * Playback metadata for a catalogue sample. The catalogue leaves `bpm` null for
 * many loops even when the file name carries the tempo, so fall back to the name.
 */
export function trackOf(sample: SpliceSample, pack: SpliceSamplePack): PlayingTrack {
  return {
    uuid: sample.uuid,
    name: fileName(sample.name),
    pack: pack.name,
    durationMs: sample.duration,
    bpm: sample.bpm ?? parseBpmFromName(sample.name),
  };
}

export function fileName(name: string) {
  return name.split("/").pop() ?? name;
}
