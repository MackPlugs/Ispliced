import { SpliceTag } from "../splice/entities";

/** Included and excluded tags first, then the remaining known tags, without duplicates. */
export function orderedTags(included: SpliceTag[], excluded: SpliceTag[], known: SpliceTag[]) {
  const seen = new Set<string>();
  const ordered: SpliceTag[] = [];

  for (const tag of [...included, ...excluded, ...known]) {
    if (seen.has(tag.uuid)) continue;
    seen.add(tag.uuid);
    ordered.push(tag);
  }

  return ordered;
}
