import { SpliceSample, SpliceSamplePack } from "./api";

// eslint-disable-next-line no-control-regex -- control characters are illegal in Windows file names
const ILLEGAL_PATH_CHARS = /[<>:"|?*\x00-\x1f /\\]/g;
const TRAILING_DOTS_OR_SPACES = /[. ]+$/g;
const FILE_EXTENSION = /\.[^.]+$/;
const RESERVED_WINDOWS_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i;
const MAX_PART_LENGTH = 100;

const UNKNOWN_INSTRUMENT = "Other";
const LOOP_FOLDER = "Loops";
const ONE_SHOT_FOLDER = "One-Shots";
const CATEGORY_WORDS = new Set([
  "loop", "loops", "oneshot", "oneshots", "one-shot", "one-shots", "sample", "samples",
]);

/**
 * `classified` groups by instrument and loop type; `pack` keeps only the pack folder,
 * which is short enough for the Windows shell when a classified path is too long.
 */
export type SamplePathLayout = "classified" | "pack";

/** Makes one path segment safe on Windows without changing what it means. */
export function safePart(value: string) {
  const clean = value.replace(ILLEGAL_PATH_CHARS, "_")
    .slice(0, MAX_PART_LENGTH)
    .replace(TRAILING_DOTS_OR_SPACES, "");

  if (!clean || clean === "." || clean === "..") return "sample";
  return RESERVED_WINDOWS_NAME.test(clean) ? `_${clean}` : clean;
}

function nameParts(sample: SpliceSample) {
  return sample.name.split(/[/\\]/).filter(part => part && part !== "." && part !== "..");
}

/** The exported file name for a sample, without its pack or sample folders. */
export function sampleFileName(sample: SpliceSample) {
  const name = nameParts(sample).pop() || sample.uuid;
  return `${safePart(name.replace(FILE_EXTENSION, ""))}.wav`;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

/** The sample's own first folder, unless it only describes the loop type. */
function inferredInstrument(sample: SpliceSample) {
  const [first] = nameParts(sample);
  return first && !CATEGORY_WORDS.has(first.toLowerCase()) ? first : "";
}

function instrumentFolder(sample: SpliceSample) {
  const instrument = sample.instrument?.trim() || inferredInstrument(sample) || UNKNOWN_INSTRUMENT;
  return safePart(titleCase(instrument));
}

function categoryFolder(sample: SpliceSample) {
  return sample.asset_category_slug === "oneshot" ? ONE_SHOT_FOLDER : LOOP_FOLDER;
}

/** Where a sample is exported, relative to the sample folder. */
export function samplePath(pack: SpliceSamplePack, sample: SpliceSample, layout: SamplePathLayout = "classified") {
  const folders = layout === "classified"
    ? [safePart(pack.name), instrumentFolder(sample), categoryFolder(sample)]
    : [safePart(pack.name)];

  return [...folders, sampleFileName(sample)].join("/");
}
