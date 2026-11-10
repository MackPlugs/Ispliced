export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 120;

const MIN_RATE = 0.5;
const MAX_RATE = 2;

/** How fast to play a loop so it lands on `targetBpm`, or 1 when unlocked. */
export function tempoRate(trackBpm: number | null, targetBpm: number, enabled: boolean) {
  if (!enabled || !trackBpm || targetBpm <= 0) return 1;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, targetBpm / trackBpm));
}

/** Keeps a typed BPM inside the supported range. */
export function clampBpm(value: number) {
  if (!Number.isFinite(value)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)));
}
