import { SpliceSample } from "./api";
import { errorMessage } from "../errors";

export interface SaveProgress { saved: number; failed: number; found: number; }
export interface SaveResult extends SaveProgress { errors: string[]; }

export type SaveSample = (sample: SpliceSample, relativePath: string) => Promise<void>;
export type ReportProgress = (progress: SaveProgress) => void;

const MAX_CONCURRENT_SAVES = 2;
const MAX_REPORTED_ERRORS = 3;

/** Adds a numeric suffix when another sample already claimed this file name. */
export function claimPath(relativePath: string, taken: Set<string>) {
  let claimed = relativePath;
  let suffix = 1;

  while (taken.has(claimed.toLowerCase())) {
    claimed = relativePath.replace(/\.wav$/, `_${suffix++}.wav`);
  }

  taken.add(claimed.toLowerCase());
  return claimed;
}

export interface SaveBatchOptions {
  /** The export path for one sample, before collisions are resolved. */
  pathFor: (sample: SpliceSample) => string;
  save: SaveSample;
  onProgress: ReportProgress;
  result: SaveResult;
  paths: Set<string>;
}

/** Writes `items` two at a time, recording successes and failures in `result`. */
export async function saveBatch(items: SpliceSample[], options: SaveBatchOptions) {
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      await saveOne(items[next++], options);
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_SAVES, items.length) }, worker));
}

async function saveOne(sample: SpliceSample, options: SaveBatchOptions) {
  const relativePath = claimPath(options.pathFor(sample), options.paths);

  try {
    await options.save(sample, relativePath);
    options.result.saved++;
  } catch (error) {
    options.result.failed++;
    if (options.result.errors.length < MAX_REPORTED_ERRORS) {
      options.result.errors.push(`${sample.name}: ${errorMessage(error)}`);
    }
  }

  options.onProgress({ ...options.result });
}
