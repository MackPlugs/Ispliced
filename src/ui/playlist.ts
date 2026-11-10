/**
 * Index of the neighbouring result, or `null` when there is none. The list does
 * not wrap: at the first result `-1` returns null, at the last `1` returns null.
 */
export function neighbourIndex(length: number, index: number, offset: -1 | 1): number | null {
  if (index < 0 || index >= length) return null;

  const next = index + offset;
  return next >= 0 && next < length ? next : null;
}
