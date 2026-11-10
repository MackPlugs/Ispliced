import type { ChordType, MusicKey } from "../splice/entities";

export type MatchTolerance = "exact" | "near" | "half" | "double";

export type LoopMatch = {
  bpm: number | null;
  key: string | null;
  tolerance: MatchTolerance;
};

const NEAR_BPM = 2;
const MIN_BPM = 1;
const MAX_BPM = 300;

/** Local key and rhythm analysis reads WAV; keep the picker and backend in step. */
export const SUPPORTED_LOOP_EXTENSIONS = ["wav"];

/** Whether local analysis can read this dropped or chosen file. */
export function isSupportedLoopFile(path: string) {
  const extension = path.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase();
  return extension != null && SUPPORTED_LOOP_EXTENSIONS.includes(extension);
}

export function loopFileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

/** The BPM window a catalogue match should search. */
export function toleranceRange(bpm: number, tolerance: MatchTolerance) {
  const centre = tolerance === "half" ? bpm / 2 : tolerance === "double" ? bpm * 2 : bpm;
  const spread = tolerance === "exact" ? 0 : NEAR_BPM;

  return {
    minBpm: clamp(Math.round(centre) - spread),
    maxBpm: clamp(Math.round(centre) + spread),
  };
}

function clamp(value: number) {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value));
}

const NOTES: MusicKey[] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const FLATS: Record<string, MusicKey> = {
  Cb: "B", Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#",
};

/** Splits a detected label such as `F#min` into the catalogue's key and chord. */
export function splitKey(key: string | null): { musicKey: MusicKey | null; chordType: ChordType | null } {
  const match = key == null ? null : /^([A-G][#b]?)(maj|min)/.exec(key);
  if (match == null) return { musicKey: null, chordType: null };

  return {
    musicKey: toNote(match[1]),
    chordType: match[2] === "min" ? "minor" : "major",
  };
}

function toNote(value: string): MusicKey | null {
  if (value.includes("b")) return FLATS[value] ?? null;
  return NOTES.includes(value as MusicKey) ? value as MusicKey : null;
}
