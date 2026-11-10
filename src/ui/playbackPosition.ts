/** The position of a preview as a fraction of its duration, clamped to the track. */
export function fractionOf(currentTime: number, duration: number, fallback = 0) {
  if (!Number.isFinite(duration) || duration <= 0) return resumeFraction(fallback);
  return Math.min(1, Math.max(0, currentTime / duration));
}

/**
 * A remembered position to start from. A preview that reached the end restarts
 * instead of seeking straight back to its final frame.
 */
export function resumeFraction(fraction: number) {
  if (!Number.isFinite(fraction) || fraction <= 0) return 0;
  return fraction >= 0.999 ? 0 : fraction;
}
