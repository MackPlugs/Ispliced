import { Alert, AlertContent, AlertDescription, AlertIndicator, AlertTitle, Button } from "@heroui/react";
import { X } from "lucide-react";

import { cfg } from "../../config";
import type { BrowseController } from "../useBrowse";
import BrowseToolbar from "./BrowseToolbar";
import FilterBar from "./FilterBar";
import PackFilterBanner from "./PackFilterBanner";
import ResultsPane from "./ResultsPane";
import TagFilters from "./TagFilters";

/** Renders the browse screen; all of its state lives in `useBrowse`. */
export default function BrowseView({ browse, sampleDirMissing, onOpenSettings }: {
  browse: BrowseController;
  sampleDirMissing: boolean;
  onOpenSettings: () => void;
}) {
  const { filters, search, downloads, selection, savedSearches } = browse;
  const filteredPack = browse.packFilter;

  return (
    <>
      {downloads.notice &&
        <Alert status={downloads.notice.status} role="status" className="items-center">
          <AlertIndicator />
          <AlertContent>
            <AlertTitle>{downloads.notice.title}</AlertTitle>
            <AlertDescription>{downloads.notice.description}</AlertDescription>
          </AlertContent>
          {!downloads.downloadingPackId &&
            <Button isIconOnly size="sm" variant="ghost" aria-label="Dismiss download notification"
              onClick={downloads.dismissNotice}><X className="size-4" /></Button>}
        </Alert>}

      <BrowseToolbar
        view={browse.view}
        query={filters.query}
        searchLoading={search.loading}
        showResults={browse.showResults}
        hasFilters={Boolean(filters.query || browse.filtersActive)}
        sortBy={filters.sortBy}
        selectedCount={browse.selectedCount}
        savedSearches={savedSearches}
        onQueryChange={browse.handleSearchInput}
        onSearchKeyDown={browse.handleSearchKeyDown}
        onSortChange={filters.setSortBy}
        onClear={() => {
          filters.clear();
          browse.refreshSearch();
        }}
        onDownloadSelected={() => void browse.downloadSelected()}
        onSaveSearch={browse.saveCurrentSearch}
        onLoadSearch={browse.applySavedSearch}
        onDeleteSearch={id => void browse.removeSavedSearch(id)}
        onOpenSettings={onOpenSettings}
      />

      {browse.view === "packs" &&
        <p className="text-sm text-muted">Browse packs by name. Audio filters find packs containing matching samples.</p>}

      <FilterBar
        knownInstruments={search.knownInstruments}
        knownGenres={search.knownGenres}
        instruments={[...(filters.excludeMode ? filters.excludedInstruments : filters.instruments)]}
        genres={[...(filters.excludeMode ? filters.excludedGenres : filters.genres)]}
        excludedInstruments={[...filters.excludedInstruments]}
        excludedGenres={[...filters.excludedGenres]}
        excludeMode={filters.excludeMode}
        onExcludeModeChange={filters.setExcludeMode}
        onInstrumentsChange={values => (filters.excludeMode ? filters.setExcludedInstruments : filters.setInstruments)(new Set(values))}
        onGenresChange={values => (filters.excludeMode ? filters.setExcludedGenres : filters.setGenres)(new Set(values))}
        musicKey={filters.musicKey}
        chordType={filters.chordType}
        onMusicKeyChange={filters.setMusicKey}
        onChordTypeChange={filters.setChordType}
        bpm={filters.bpm}
        bpmType={filters.bpmType}
        bpmOpen={browse.bpmOpen}
        onBpmOpenChange={browse.setBpmOpen}
        onBpmChange={(type, value) => {
          filters.setBpmType(type);
          filters.setBpm(value);
          browse.setBpmOpen(false);
        }}
        onBpmClear={() => {
          filters.setBpm(undefined);
          browse.setBpmOpen(false);
        }}
        sampleType={filters.sampleType}
        onSampleTypeChange={filters.setSampleType}
      />

      {browse.showResults && (search.knownTags.length > 0 || filters.tags.length > 0 || filters.excludedTags.length > 0) &&
        <TagFilters
          tags={filters.tags}
          excludedTags={filters.excludedTags}
          knownTags={search.knownTags}
          expanded={browse.tagsExpanded}
          onToggleTag={filters.excludeMode ? filters.toggleExcludedTag : filters.toggleTag}
          onExpandedChange={browse.setTagsExpanded}
        />}

      {filteredPack != null &&
        <PackFilterBanner
          pack={filteredPack}
          downloading={downloads.downloadingPackId === filteredPack.uuid}
          downloadDisabled={downloads.downloadingPackId !== null}
          canReturnToPacks={browse.packSearchReturnable}
          onDownload={() => void downloads.downloadPack(filteredPack)}
          onReturnToPacks={browse.showPacks}
          onClear={browse.clearPackFilter}
        />}

      {sampleDirMissing && cfg().configured &&
        <Alert status="warning" className="items-center">
          <AlertIndicator />
          <AlertContent>
            <AlertTitle>Sample folder not found</AlertTitle>
            <AlertDescription>
              Drag-and-drop won't work until you choose an existing folder in the settings.
            </AlertDescription>
          </AlertContent>
          <Button size="sm" variant="secondary" onClick={onOpenSettings}>Open settings</Button>
        </Alert>}

      <ResultsPane
        view={browse.view}
        showResults={browse.showResults}
        resultCount={browse.resultCount}
        results={search.results}
        packs={search.packs}
        searchLoading={search.loading}
        searchError={search.error}
        filtersActive={browse.filtersActive}
        currentPage={browse.currentPage}
        totalPages={search.totalPages}
        selectedSamples={selection.selectedSamples}
        downloadingPackId={downloads.downloadingPackId}
        resultContainer={browse.resultContainer}
        onScroll={browse.rememberScroll}
        onPackClick={browse.handlePackClick}
        onDownloadPack={pack => void downloads.downloadPack(pack)}
        onToggleSample={selection.toggle}
        onTagClick={browse.handleTagClick}
        onChangePage={browse.changePage}
        onLoadMore={browse.loadMore}
      />
    </>
  );
}
