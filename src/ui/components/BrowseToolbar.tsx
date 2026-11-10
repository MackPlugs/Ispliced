import {
  Button, InputGroup, InputGroupInput, InputGroupPrefix, InputGroupSuffix,
  ListBox, ListBoxItem, ListBoxItemIndicator,
  ProgressCircle, ProgressCircleFillCircle, ProgressCircleTrack, ProgressCircleTrackCircle,
  Select, SelectIndicator, SelectPopover, SelectTrigger, SelectValue,
} from "@heroui/react";
import { ArrowUpDown, Download, Search, Wrench } from "lucide-react";

import { SpliceSortBy } from "../../splice/entities";
import { FIELD_BUTTON_CLASSES } from "../fieldStyles";
import { SavedSearch } from "../savedSearch";
import SavedSearches from "./SavedSearches";

export default function BrowseToolbar({ view, query, searchLoading, showResults, hasFilters, sortBy, selectedCount, savedSearches, onQueryChange, onSearchKeyDown, onSortChange, onClear, onDownloadSelected, onSaveSearch, onLoadSearch, onDeleteSearch, onOpenSettings }: {
  view: "samples" | "packs";
  query: string;
  searchLoading: boolean;
  showResults: boolean;
  hasFilters: boolean;
  sortBy: SpliceSortBy;
  selectedCount: number;
  savedSearches: SavedSearch[];
  onQueryChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSortChange: (sort: SpliceSortBy) => void;
  onClear: () => void;
  onDownloadSelected: () => void;
  onSaveSearch: (name: string) => void;
  onLoadSearch: (search: SavedSearch) => void;
  onDeleteSearch: (id: string) => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex gap-2">
      <InputGroup className="flex-1">
        <InputGroupPrefix>
          <Search className="size-5" />
        </InputGroupPrefix>
        <InputGroupInput
          type="text"
          aria-label={view === "packs" ? "Search for sample packs" : "Search for samples"}
          placeholder={view === "packs" ? "Search for sample packs..." : "Search for samples..."}
          value={query}
          onKeyDown={onSearchKeyDown}
          onChange={onQueryChange}
        />
        { /* Only show loading for searches whose results are displayed. */ }
        { searchLoading && showResults &&
          <InputGroupSuffix>
            <ProgressCircle aria-label="Loading results..." isIndeterminate className="size-5">
              <ProgressCircleTrack>
                <ProgressCircleTrackCircle />
                <ProgressCircleFillCircle />
              </ProgressCircleTrack>
            </ProgressCircle>
          </InputGroupSuffix>
        }
      </InputGroup>

      <Select
        aria-label="Sort by"
        value={sortBy}
        onChange={value => onSortChange(value as SpliceSortBy)}
        className="w-48"
      >
        <SelectTrigger>
          <ArrowUpDown className="size-4 me-2 self-center shrink-0 text-muted" />
          <SelectValue />
          <SelectIndicator />
        </SelectTrigger>
        <SelectPopover>
          <ListBox>
            <ListBoxItem id="relevance" textValue="Most relevant">Most relevant<ListBoxItemIndicator /></ListBoxItem>
            <ListBoxItem id="popularity" textValue="Most popular">Most popular<ListBoxItemIndicator /></ListBoxItem>
            <ListBoxItem id="recency" textValue="Most recent">Most recent<ListBoxItemIndicator /></ListBoxItem>
            <ListBoxItem id="random" textValue="Random">Random<ListBoxItemIndicator /></ListBoxItem>
          </ListBox>
        </SelectPopover>
      </Select>

      {hasFilters && <Button variant="outline" onClick={onClear}>Clear search</Button>}

      {view === "samples" &&
        <Button variant="outline" isDisabled={selectedCount === 0} onClick={onDownloadSelected}>
          <Download className="size-4" />
          Download{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>}

      <SavedSearches searches={savedSearches} onSave={onSaveSearch}
        onLoad={onLoadSearch} onDelete={onDeleteSearch} />

      <Button isIconOnly variant="outline" className={FIELD_BUTTON_CLASSES} aria-label="Settings" onClick={onOpenSettings}>
        <Wrench className="size-4" />
      </Button>
    </div>
  );
}
