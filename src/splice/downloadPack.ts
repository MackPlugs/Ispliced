import { createSearchRequest, SpliceSample, SpliceSamplePack } from "./api";
import { readSearchResponse } from "./packs";
import { samplePath } from "./samplePath";
import { errorMessage } from "../errors";

export interface PackDownloadProgress { saved: number; failed: number; found: number; }
export interface PackDownloadResult extends PackDownloadProgress { errors: string[]; }

const MAX_CONCURRENT_SAVES = 2;
const MAX_REPORTED_ERRORS = 3;

type SaveSample = (sample: SpliceSample, relativePath: string) => Promise<void>;
type ReportProgress = (progress: PackDownloadProgress) => void;

interface DownloadState {
  pack: SpliceSamplePack;
  search: (body: string) => Promise<string>;
  save: SaveSample;
  onProgress: ReportProgress;
  result: PackDownloadResult;
  seen: Set<string>;
  paths: Set<string>;
}

/** Adds a numeric suffix when another sample already claimed this file name. */
function claimPath(relativePath: string, taken: Set<string>) {
  let claimed = relativePath;
  let suffix = 1;

  while (taken.has(claimed.toLowerCase())) {
    claimed = relativePath.replace(/\.wav$/, `_${suffix++}.wav`);
  }

  taken.add(claimed.toLowerCase());
  return claimed;
}

function packPageRequest(pack: SpliceSamplePack, page: number) {
  const request = createSearchRequest("");
  request.variables.parent_asset_uuid = pack.uuid;
  request.variables.parent_asset_type = "pack";
  request.variables.sort = "recency";
  request.variables.page = page;
  return request;
}

async function saveOne(state: DownloadState, sample: SpliceSample) {
  const relativePath = claimPath(samplePath(state.pack, sample), state.paths);

  try {
    await state.save(sample, relativePath);
    state.result.saved++;
  } catch (error) {
    state.result.failed++;
    if (state.result.errors.length < MAX_REPORTED_ERRORS) {
      state.result.errors.push(`${sample.name}: ${errorMessage(error)}`);
    }
  }

  state.onProgress({ ...state.result });
}

/** Keeps two transfers in flight at once and resolves when every write finishes. */
async function savePage(state: DownloadState, items: SpliceSample[]) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      await saveOne(state, items[next++]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_SAVES, items.length) }, worker));
}

/** Fetch every pack page without inheriting the browse filters. */
export async function downloadPack(
  pack: SpliceSamplePack,
  search: (body: string) => Promise<string>,
  save: SaveSample,
  onProgress: ReportProgress,
): Promise<PackDownloadResult> {
  const state: DownloadState = {
    pack, search, save, onProgress,
    result: { saved: 0, failed: 0, found: 0, errors: [] },
    seen: new Set(),
    paths: new Set(),
  };

  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    const data = readSearchResponse(await search(JSON.stringify(packPageRequest(pack, page))));
    totalPages = data.pagination_metadata.totalPages;

    const fresh = data.items.filter(sample => {
      if (state.seen.has(sample.uuid)) return false;
      state.seen.add(sample.uuid);
      return true;
    });

    state.result.found += fresh.length;
    state.onProgress({ ...state.result });

    await savePage(state, fresh);
  }

  if (!state.result.found) throw new Error("No samples were found in this pack.");
  return state.result;
}
