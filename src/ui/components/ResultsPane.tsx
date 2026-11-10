import type { RefObject } from "react";
import {
  Button, Pagination, PaginationContent, PaginationEllipsis, PaginationItem,
  PaginationLink, PaginationNext, PaginationNextIcon, PaginationPrevious, PaginationPreviousIcon,
} from "@heroui/react";

import { SpliceSample, SpliceSamplePack } from "../../splice/api";
import type { TagClickHandler, PackClickHandler } from "./SampleListEntry";
import PackCard from "./PackCard";
import SampleListEntry from "./SampleListEntry";

export default function ResultsPane({
  view, showResults, resultCount, results, packs, searchLoading, searchError, filtersActive,
  currentPage, totalPages, selectedSamples, downloadingPackId, resultContainer,
  onScroll, onPackClick, onDownloadPack, onToggleSample, onTagClick, onChangePage, onLoadMore,
}: {
  view: "samples" | "packs";
  showResults: boolean;
  resultCount: number;
  results: SpliceSample[];
  packs: SpliceSamplePack[];
  searchLoading: boolean;
  searchError: string | null;
  filtersActive: boolean;
  currentPage: number;
  totalPages: number;
  selectedSamples: Set<string>;
  downloadingPackId: string | null;
  resultContainer: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onPackClick: PackClickHandler;
  onDownloadPack: (pack: SpliceSamplePack) => void;
  onToggleSample: (uuid: string) => void;
  onTagClick: TagClickHandler;
  onChangePage: (page: number) => void;
  onLoadMore: () => void;
}) {
  if (searchError != null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <img className="w-12 select-none" src="img/blob-think.png" alt="" draggable={false} />
        <div className="space-y-1">
          <p className="text-muted">Something went wrong while searching.</p>
          <p className="text-sm text-muted/75 max-w-xl">{searchError}</p>
        </div>
      </div>
    );
  }

  if (!showResults) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <img className="w-12 select-none" src="img/blob-salute.png" alt="" draggable={false} />
        <p className="text-muted">Waiting for your command!</p>
      </div>
    );
  }

  if (resultCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
        <img className="w-12 select-none" src="img/blob-think.png" alt="" draggable={false} />
        <p className="text-muted">{searchLoading ? "Searching…" : view === "packs" && filtersActive && currentPage < totalPages
          ? "No matching packs yet. Load more packs to continue searching."
          : "Couldn't find anything. Try changing your query and filters."}</p>
      </div>
    );
  }

  return (
    <>
      <div ref={resultContainer} onScroll={onScroll}
        aria-label={view === "packs" ? "Sample packs" : "Sample results"}
        aria-busy={searchLoading}
        className="flex-1 min-h-0 mt-2 overflow-y-auto scrollbar-thin shadow-md bg-surface p-6 rounded-3xl flex flex-col gap-6"
      >
        <div className={`flex-1 ${view === "packs" ? "grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 content-start" : "flex flex-col"} transition-opacity duration-150
                        ${searchLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {view === "packs"
            ? packs.map(pack =>
                <PackCard key={pack.uuid} pack={pack} onOpen={onPackClick}
                  onDownload={onDownloadPack}
                  downloading={downloadingPackId === pack.uuid}
                  downloadDisabled={downloadingPackId !== null} />)
            : results.map(sample =>
                <SampleListEntry key={sample.uuid} sample={sample}
                  selected={selectedSamples.has(sample.uuid)}
                  onToggleSelected={() => onToggleSample(sample.uuid)}
                  onTagClick={onTagClick} onPackClick={onPackClick} />)}
        </div>

        {totalPages > 1 && !(view === "packs" && filtersActive) &&
          <div className="w-full flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => onChangePage(Math.max(1, currentPage - 1))}
                    isDisabled={currentPage <= 1}
                  >
                    <PaginationPreviousIcon />
                  </PaginationPrevious>
                </PaginationItem>
                {buildPageList(currentPage, totalPages).map((page, index) =>
                  page === "ellipsis"
                    ? <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem>
                    : <PaginationItem key={page}>
                        <PaginationLink isActive={page === currentPage} onClick={() => onChangePage(page)}>{page}</PaginationLink>
                      </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
                    isDisabled={currentPage >= totalPages}
                  >
                    <PaginationNextIcon />
                  </PaginationNext>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        }
      </div>

      {view === "packs" && filtersActive && currentPage < totalPages &&
        <div className="flex justify-center items-center gap-3 py-2">
          <p className="text-sm text-muted">{packs.length} packs found so far</p>
          <Button variant="outline" isDisabled={searchLoading} onClick={onLoadMore}>Load more packs</Button>
        </div>}
    </>
  );
}

function buildPageList(current: number, total: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  for (let page = 1; page <= total; page++) {
    if (page === 1 || page === total || Math.abs(page - current) <= 2) {
      pages.push(page);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }
  return pages;
}
