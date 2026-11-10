import { SpliceSamplePack } from "../splice/api";

/** "128 samples · Label · Genre", or an empty string when the pack carries no metadata. */
export function packDetails(pack: SpliceSamplePack) {
  const sampleCount = sampleCountOf(pack);

  return [
    sampleCount != null ? `${sampleCount} samples` : null,
    pack.provider?.name,
    pack.main_genre,
  ].filter(Boolean).join(" · ");
}

/** Matches "sample", "Samples" and "sample_asset" alike; unknown types simply omit the count. */
function sampleCountOf(pack: SpliceSamplePack) {
  const counts = pack.child_asset_counts ?? [];
  return counts.find(entry => entry.type.toLowerCase().includes("sample"))?.count;
}
