import { SpliceSample } from "./api";
import { samplePath } from "./samplePath";
import { ReportProgress, SaveResult, SaveSample, saveBatch } from "./saveBatch";

/** Saves the given catalogue samples, each under its own pack. */
export async function downloadSamples(
  samples: SpliceSample[],
  save: SaveSample,
  onProgress: ReportProgress,
): Promise<SaveResult> {
  const result: SaveResult = { saved: 0, failed: 0, found: samples.length, errors: [] };

  await saveBatch(samples, {
    pathFor: sample => samplePath(sample.parents.items[0], sample),
    save,
    onProgress,
    result,
    paths: new Set(),
  });

  return result;
}
