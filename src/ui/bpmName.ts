/**
 * BPM written into a sample file name.
 *
 * Splice names usually carry the tempo as a bare token (`STCR2_DMDH_125_Vocal`)
 * rather than an explicit "125 BPM", and the catalogue leaves `bpm` null for many
 * loops. Reading the name recovers the tempo for tempo lock and loop matching.
 */

const EXPLICIT_BPM = /(?<!\d)(\d{2,3})\s?bpm\b/i;
const DIGITS = /^\d{2,3}$/;
const SEPARATORS = /[^0-9A-Za-z]+/;
const MIN_NAME_BPM = 70;
const MAX_NAME_BPM = 190;
const ABSOLUTE_MIN_BPM = 1;
const ABSOLUTE_MAX_BPM = 300;

/** The file name part of a catalogue path. */
export function fileNameOf(name: string) {
  return name.split("/").pop() ?? name;
}

/** The BPM token in `name`, preferring an explicit "NNN BPM" marker. */
export function parseBpmFromName(name: string): number | null {
  const file = fileNameOf(name);

  const explicit = EXPLICIT_BPM.exec(file);
  if (explicit != null) {
    const bpm = Number(explicit[1]);
    return inRange(bpm, ABSOLUTE_MIN_BPM, ABSOLUTE_MAX_BPM) ? bpm : null;
  }

  return standaloneToken(file);
}

/** A conservative 2-3 digit token, which covers Splice names without matching 808s or years. */
function standaloneToken(file: string) {
  for (const token of file.split(SEPARATORS)) {
    if (!DIGITS.test(token)) continue;

    const bpm = Number(token);
    if (inRange(bpm, MIN_NAME_BPM, MAX_NAME_BPM)) return bpm;
  }

  return null;
}

function inRange(value: number, min: number, max: number) {
  return value >= min && value <= max;
}
