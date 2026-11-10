import { createSearchRequest, SpliceSamplePack } from "./api";
import { readSearchResponse } from "./packs";
import { samplePath } from "./samplePath";
import { ReportProgress, SaveResult, SaveSample, saveBatch } from "./saveBatch";

/** Fetch every pack page without inheriting the browse filters. */
export async function downloadPack(
  pack: SpliceSamplePack,
  search: (body: string) => Promise<string>,
  save: SaveSample,
  onProgress: ReportProgress,
): Promise<SaveResult> {
  const result: SaveResult = { saved: 0, failed: 0, found: 0, errors: [] };
  const seen = new Set<string>();
  const paths = new Set<string>();

  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    const data = readSearchResponse(await search(JSON.stringify(packPageRequest(pack, page))));
    totalPages = data.pagination_metadata.totalPages;

    const fresh = data.items.filter(sample => {
      if (seen.has(sample.uuid)) return false;
      seen.add(sample.uuid);
      return true;
    });

    result.found += fresh.length;
    onProgress({ ...result });

    await saveBatch(fresh, { pathFor: sample => samplePath(pack, sample), save, onProgress, result, paths });
  }

  if (!result.found) throw new Error("No samples were found in this pack.");
  return result;
}

function packPageRequest(pack: SpliceSamplePack, page: number) {
  const request = createSearchRequest("");
  request.variables.parent_asset_uuid = pack.uuid;
  request.variables.parent_asset_type = "pack";
  request.variables.sort = "recency";
  request.variables.page = page;
  return request;
}
