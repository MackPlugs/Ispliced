import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button, InputGroup, InputGroupInput, InputGroupPrefix, ListBox, ListBoxItem,
  ListBoxItemIndicator, Popover, PopoverContent, PopoverDialog,
  Select, SelectIndicator, SelectPopover, SelectTrigger, SelectValue,
  ToggleButton, toast,
} from "@heroui/react";
import { AudioLines, Search, Star } from "lucide-react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { listen } from "@tauri-apps/api/event";

import { cfg } from "../../config";
import { DRAG_PREVIEW_ICON } from "../../dragIcon";
import { errorMessage } from "../../errors";
import {
  IN_TAURI, LibraryEntry, LibraryIndex, ScanProgress, SimilarMatch, SimilarMode,
  cancelLibraryScan, findSimilar, loadLibrary, scanLibrary, setLibraryFavorite,
} from "../../native";
import { missingPaths } from "../collections";
import { duplicateCounts } from "../libraryDuplicates";
import {
  DEFAULT_LIBRARY_SORT, EMPTY_LIBRARY_FILTERS, LibraryFilters, LibrarySort, LibrarySortColumn,
  filterLibrary, sortLibrary, uniqueInstruments, uniqueKeys,
} from "../libraryFilters";
import { useCollections } from "../useCollections";

const KINDS = [
  { id: "loop", name: "Loops" },
  { id: "one-shot", name: "One-Shots" },
  { id: "other", name: "Other" },
] as const;

export default function LibraryView() {
  const [index, setIndex] = useState<LibraryIndex | null>(null);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_LIBRARY_FILTERS);
  const [sort, setSort] = useState<LibrarySort>(DEFAULT_LIBRARY_SORT);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [newCollection, setNewCollection] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [similarTo, setSimilarTo] = useState<LibraryEntry | null>(null);
  const [similar, setSimilar] = useState<SimilarMatch[]>([]);
  const [similarMode, setSimilarMode] = useState<SimilarMode>("combined");
  const [similarLoading, setSimilarLoading] = useState(false);
  const favoriteQueue = useRef(Promise.resolve());
  const { collections, create, remove, addPaths, removePaths } = useCollections();

  useEffect(() => {
    if (!IN_TAURI) return;

    loadLibrary()
      .then(setIndex)
      .catch(err => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!IN_TAURI) return;

    let disposed = false;
    let stop: (() => void) | undefined;

    void listen<ScanProgress>("library-scan-progress", event => setScanProgress(event.payload))
      .then(unlisten => {
        if (disposed) unlisten();
        else stop = unlisten;
      });

    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  const duplicates = useMemo(() => duplicateCounts(index?.entries ?? []), [index]);
  const collection = collections.find(entry => entry.id === collectionId) ?? null;
  const knownPaths = useMemo(() => new Set((index?.entries ?? []).map(entry => entry.path)), [index]);
  const missing = collection == null ? [] : missingPaths(collection, knownPaths);

  const entries = useMemo(() => {
    const matched = filterLibrary(index?.entries ?? [], filters, duplicates);
    if (collection == null) return sortLibrary(matched, sort);

    const saved = new Set(collection.paths);
    return sortLibrary(matched.filter(entry => saved.has(entry.path)), sort);
  }, [index, filters, duplicates, collection, sort]);

  const instruments = useMemo(() => uniqueInstruments(index?.entries ?? []), [index]);
  const keys = useMemo(() => uniqueKeys(index?.entries ?? []), [index]);

  async function scan() {
    const folder = cfg().sampleDir;
    if (!IN_TAURI || !folder.trim()) return;

    setScanning(true);
    setError(null);
    setScanProgress(null);
    try {
      setIndex(await scanLibrary(folder));
    } catch (err) {
      const message = errorMessage(err);
      if (message.includes("cancelled")) {
        toast("Library scan cancelled");
      } else {
        setError(message);
        toast.danger("Library scan failed", { description: message });
      }
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }

  function toggleFavorite(entry: LibraryEntry) {
    favoriteQueue.current = favoriteQueue.current
      .then(() => setLibraryFavorite(entry.path, !entry.favorite))
      .then(setIndex)
      .catch(error => {
        toast.danger("Could not update favourites", { description: errorMessage(error) });
      });
  }

  async function showSimilar(entry: LibraryEntry, mode = similarMode) {
    setSimilarTo(entry);
    setSimilar([]);
    setSimilarLoading(true);
    try {
      setSimilar(await findSimilar(entry.path, 12, mode));
    } catch (err) {
      toast.danger("Could not find similar sounds", { description: errorMessage(err) });
      setSimilarTo(null);
    } finally {
      setSimilarLoading(false);
    }
  }

  function changeSimilarMode(mode: SimilarMode) {
    setSimilarMode(mode);
    if (similarTo != null) void showSimilar(similarTo, mode);
  }

  function toggleSelected(path: string) {
    setSelectedPaths(current => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function createCollection() {
    const created = create(newCollection);
    if (created == null) return;

    setNewCollection("");
    setCollectionId(created.id);
  }

  function removeMissing() {
    if (collection == null) return;
    removePaths(collection.id, missing);
  }

  if (similarTo != null) {
    return (
      <SimilarPanel
        target={similarTo}
        matches={similar}
        loading={similarLoading}
        mode={similarMode}
        onModeChange={changeSimilarMode}
        onBack={() => { setSimilarTo(null); setSimilar([]); }}
      />
    );
  }

  return (
    <div className="mt-2 flex flex-1 min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <InputGroup className="flex-1">
          <InputGroupPrefix>
            <Search className="size-5" />
          </InputGroupPrefix>
          <InputGroupInput
            type="text"
            aria-label="Search your library"
            placeholder="Search your library..."
            value={filters.query}
            onChange={event => setFilters(current => ({ ...current, query: event.target.value }))}
          />
        </InputGroup>

        <ToggleButton isSelected={filters.favoritesOnly}
          onChange={favoritesOnly => setFilters(current => ({ ...current, favoritesOnly }))}
          aria-label="Show favourites only">
          <Star className="size-4" fill={filters.favoritesOnly ? "currentColor" : "none"} />
          Favourites
        </ToggleButton>

        <ToggleButton isSelected={filters.duplicatesOnly}
          onChange={duplicatesOnly => setFilters(current => ({ ...current, duplicatesOnly }))}
          aria-label="Show duplicates only">
          Duplicates
        </ToggleButton>

        {scanning
          ? <Button variant="outline" onClick={() => void cancelLibraryScan()}>Cancel</Button>
          : <Button variant="outline" onClick={scan} isDisabled={!cfg().sampleDir.trim()}>Scan folder</Button>}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select aria-label="Library instruments"
          selectionMode="multiple"
          placeholder="Instruments"
          value={filters.instruments}
          onChange={values => setFilters(current => ({ ...current, instruments: values as string[] }))}
          className="w-48"
        >
          <SelectTrigger><SelectValue className="truncate" /><SelectIndicator /></SelectTrigger>
          <SelectPopover>
            <ListBox items={instruments.map(name => ({ id: name, name }))}>
              {(item: { id: string, name: string }) => <ListBoxItem id={item.id} textValue={item.name}>{item.name}<ListBoxItemIndicator /></ListBoxItem>}
            </ListBox>
          </SelectPopover>
        </Select>

        <Select aria-label="Library types"
          selectionMode="multiple"
          placeholder="Type"
          value={filters.kinds}
          onChange={values => setFilters(current => ({ ...current, kinds: values as LibraryFilters["kinds"] }))}
          className="w-40"
        >
          <SelectTrigger><SelectValue className="truncate" /><SelectIndicator /></SelectTrigger>
          <SelectPopover>
            <ListBox items={KINDS}>
              {kind => <ListBoxItem id={kind.id} textValue={kind.name}>{kind.name}<ListBoxItemIndicator /></ListBoxItem>}
            </ListBox>
          </SelectPopover>
        </Select>

        <Select aria-label="Library keys"
          selectionMode="multiple"
          placeholder="Key"
          value={filters.keys}
          onChange={values => setFilters(current => ({ ...current, keys: values as string[] }))}
          className="w-40"
        >
          <SelectTrigger><SelectValue className="truncate" /><SelectIndicator /></SelectTrigger>
          <SelectPopover>
            <ListBox items={keys.map(key => ({ id: key, name: key }))}>
              {(item: { id: string, name: string }) => <ListBoxItem id={item.id} textValue={item.name}>{item.name}<ListBoxItemIndicator /></ListBoxItem>}
            </ListBox>
          </SelectPopover>
        </Select>

        <label className="flex flex-col gap-1 text-xs text-muted">
          Min BPM
          <input type="number" min={1} max={300} value={filters.bpmMin ?? ""}
            aria-label="Minimum BPM"
            onChange={event => setFilters(current => ({ ...current, bpmMin: numberOrNull(event.target.value) }))}
            className="w-20 rounded-md bg-surface-tertiary px-2 py-1 text-sm tabular-nums text-foreground" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted">
          Max BPM
          <input type="number" min={1} max={300} value={filters.bpmMax ?? ""}
            aria-label="Maximum BPM"
            onChange={event => setFilters(current => ({ ...current, bpmMax: numberOrNull(event.target.value) }))}
            className="w-20 rounded-md bg-surface-tertiary px-2 py-1 text-sm tabular-nums text-foreground" />
        </label>

        <Button variant="outline" onClick={() => setFilters(EMPTY_LIBRARY_FILTERS)}>Clear filters</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Collection"
          value={collectionId ?? "all"}
          onChange={value => setCollectionId(value === "all" ? null : String(value))}
          className="w-52"
        >
          <SelectTrigger><SelectValue className="truncate" /><SelectIndicator /></SelectTrigger>
          <SelectPopover>
            <ListBox>
              <ListBoxItem id="all" textValue="All files">All files<ListBoxItemIndicator /></ListBoxItem>
              {collections.map(saved =>
                <ListBoxItem key={saved.id} id={saved.id} textValue={saved.name}>
                  {saved.name}<ListBoxItemIndicator />
                </ListBoxItem>)}
            </ListBox>
          </SelectPopover>
        </Select>

        <Popover>
          <Button variant="outline">New collection</Button>
          <PopoverContent placement="bottom start">
            <PopoverDialog className="flex gap-2 p-3">
              <input type="text" value={newCollection}
                onChange={event => setNewCollection(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter") createCollection(); }}
                aria-label="Collection name"
                placeholder="Collection name"
                className="min-w-0 flex-1 rounded-md bg-surface-tertiary px-2 py-1 text-sm" />
              <Button isDisabled={!newCollection.trim()} onClick={createCollection}>Create</Button>
            </PopoverDialog>
          </PopoverContent>
        </Popover>

        <Button variant="outline"
          isDisabled={collection == null || selectedPaths.size === 0}
          onClick={() => collection && addPaths(collection.id, [...selectedPaths])}>
          Add selected
        </Button>

        <Button variant="outline"
          isDisabled={collection == null || selectedPaths.size === 0}
          onClick={() => collection && removePaths(collection.id, [...selectedPaths])}>
          Remove selected
        </Button>

        {collection != null &&
          <Button variant="outline" onClick={() => { remove(collection.id); setCollectionId(null); }}>
            Delete collection
          </Button>}
      </div>

      <p className="text-sm text-muted">
        {scanning && scanProgress
          ? `Scanning ${scanProgress.processed} of ${scanProgress.total} files...`
          : index == null
            ? "No scan yet. Scan your sample folder to index what you have downloaded."
            : `${entries.length} of ${index.entries.length} files · `
              + `${index.entries.filter(entry => entry.favorite).length} favourites · `
              + `${duplicates.size} duplicate groups · `
              + `scanned ${new Date(index.scannedAt * 1000).toLocaleString()}`}
      </p>

      {collection != null && missing.length > 0 &&
        <p className="flex items-center gap-3 text-sm text-muted">
          {missing.length} saved {missing.length === 1 ? "file is" : "files are"} missing from this folder.
          <Button size="sm" variant="outline" onClick={removeMissing}>Remove missing</Button>
        </p>}

      {error != null && <p className="text-sm text-danger">{error}</p>}

      {index != null && index.entries.length > 0 &&
        <LibraryTable
          entries={entries}
          duplicates={duplicates}
          sort={sort}
          selected={selectedPaths}
          onSort={setSort}
          onToggleSelected={toggleSelected}
          onToggleFavorite={toggleFavorite}
          onSimilar={showSimilar}
        />}
    </div>
  );
}

function LibraryTable({ entries, duplicates, sort, selected, onSort, onToggleSelected, onToggleFavorite, onSimilar }: {
  entries: LibraryEntry[];
  duplicates: Map<string, number>;
  sort: LibrarySort;
  selected: Set<string>;
  onSort: (sort: LibrarySort) => void;
  onToggleSelected: (path: string) => void;
  onToggleFavorite: (entry: LibraryEntry) => void;
  onSimilar: (entry: LibraryEntry) => void;
}) {
  function changeSort(column: LibrarySortColumn) {
    onSort(sort.column === column
      ? { column, direction: sort.direction === "asc" ? "desc" : "asc" }
      : { column, direction: "asc" });
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-surface p-4 shadow-md">
      <table className="w-full text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="w-8 pb-2"><span className="sr-only">Select</span></th>
            <th className="w-8 pb-2"><span className="sr-only">Favourite</span></th>
            <SortHeader column="name" label="Name" sort={sort} onSort={changeSort} />
            <SortHeader column="pack" label="Pack" sort={sort} onSort={changeSort} />
            <SortHeader column="instrument" label="Instrument" sort={sort} onSort={changeSort} />
            <SortHeader column="kind" label="Type" sort={sort} onSort={changeSort} />
            <SortHeader column="key" label="Key" sort={sort} onSort={changeSort} />
            <SortHeader column="bpm" label="BPM" sort={sort} onSort={changeSort} />
            <SortHeader column="durationMs" label="Length" sort={sort} onSort={changeSort} />
            <th className="w-10 pb-2"><span className="sr-only">Similar</span></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const group = entry.hash ? (duplicates.get(entry.hash) ?? 0) : 0;

            return (
              <tr
                key={entry.path}
                onMouseDown={() => drag(entry.path)}
                className="cursor-grab select-none hover:bg-surface-secondary"
              >
                <td className="w-8">
                  <input type="checkbox" checked={selected.has(entry.path)}
                    onChange={() => onToggleSelected(entry.path)}
                    aria-label={`Select ${entry.name}`} data-draggable="false"
                    onMouseDown={event => event.stopPropagation()}
                    className="size-4 cursor-pointer" />
                </td>
                <td className="w-8">
                  <button
                    type="button"
                    aria-label={entry.favorite
                      ? `Remove ${entry.name} from favourites`
                      : `Add ${entry.name} to favourites`}
                    onMouseDown={event => event.stopPropagation()}
                    onClick={() => onToggleFavorite(entry)}
                    className="cursor-pointer text-muted hover:text-foreground"
                  >
                    <Star className="size-4" fill={entry.favorite ? "currentColor" : "none"} />
                  </button>
                </td>

                <td className="max-w-[22rem] truncate py-1.5" title={entry.path}>
                  {entry.name}
                  {group > 1 &&
                    <span className="ms-2 rounded bg-surface-tertiary px-1.5 py-0.5 text-xs text-muted">×{group}</span>}
                </td>

                <td className="max-w-[12rem] truncate text-muted">{entry.pack || "—"}</td>
                <td className="text-muted">{entry.instrument || "—"}</td>
                <td className="text-muted">{kindLabel(entry.kind)}</td>
                <td className="tabular-nums">{entry.key ?? "—"}</td>
                <td className="tabular-nums">{entry.bpm ?? "—"}</td>
                <td className="tabular-nums text-muted">{formatDuration(entry.durationMs)}</td>

                <td className="w-10">
                  <button
                    type="button"
                    aria-label={`Find sounds similar to ${entry.name}`}
                    onMouseDown={event => event.stopPropagation()}
                    onClick={() => onSimilar(entry)}
                    className="cursor-pointer text-muted hover:text-foreground"
                  >
                    <AudioLines className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {entries.length === 0 &&
        <p className="py-4 text-sm text-muted">No files match that search.</p>
      }
    </div>
  );
}

function SortHeader({ column, label, sort, onSort }: {
  column: LibrarySortColumn;
  label: string;
  sort: LibrarySort;
  onSort: (column: LibrarySortColumn) => void;
}) {
  const active = sort.column === column;

  return (
    <th className="pb-2">
      <button type="button" onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className="cursor-pointer hover:text-foreground">
        {label}{active ? (sort.direction === "asc" ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
}

function SimilarPanel({ target, matches, loading, mode, onModeChange, onBack }: {
  target: LibraryEntry;
  matches: SimilarMatch[];
  loading: boolean;
  mode: SimilarMode;
  onModeChange: (mode: SimilarMode) => void;
  onBack: () => void;
}) {
  return (
    <div className="mt-2 flex flex-1 min-h-0 flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>Back to library</Button>
        <p className="truncate text-sm text-muted">
          Similar to <span className="text-foreground">{target.name}</span>
        </p>

        <Select aria-label="Similarity mode"
          value={mode}
          onChange={value => onModeChange(value as SimilarMode)}
          className="ms-auto w-44"
        >
          <SelectTrigger><SelectValue /><SelectIndicator /></SelectTrigger>
          <SelectPopover>
            <ListBox>
              <ListBoxItem id="combined" textValue="Combined">Combined<ListBoxItemIndicator /></ListBoxItem>
              <ListBoxItem id="harmonic" textValue="Harmonic">Harmonic<ListBoxItemIndicator /></ListBoxItem>
              <ListBoxItem id="rhythmic" textValue="Rhythmic">Rhythmic<ListBoxItemIndicator /></ListBoxItem>
            </ListBox>
          </SelectPopover>
        </Select>
      </div>

      {loading
        ? <p className="text-sm text-muted">Comparing audio…</p>
        : <div className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-surface p-4 shadow-md">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Pack</th>
                  <th className="pb-2">Instrument</th>
                  <th className="pb-2">Match</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(match =>
                  <tr
                    key={match.path}
                    onMouseDown={() => drag(match.path)}
                    className="cursor-grab select-none hover:bg-surface-secondary"
                  >
                    <td className="max-w-[24rem] truncate py-1.5" title={match.path}>{match.name}</td>
                    <td className="max-w-[12rem] truncate text-muted">{match.pack || "—"}</td>
                    <td className="text-muted">{match.instrument || "—"}</td>
                    <td className="tabular-nums">{Math.round(match.score * 100)}%</td>
                  </tr>)}
              </tbody>
            </table>

            {matches.length === 0 &&
              <p className="py-4 text-sm text-muted">No other analysed files to compare against.</p>
            }
          </div>}
    </div>
  );
}

function drag(path: string) {
  if (!IN_TAURI) return;
  startDrag({ item: [path], icon: DRAG_PREVIEW_ICON });
}

function kindLabel(kind: LibraryEntry["kind"]) {
  if (kind === "loop") return "Loop";
  if (kind === "one-shot") return "One-shot";
  return "—";
}

function formatDuration(ms: number) {
  return ms ? `${(ms / 1000).toFixed(2)}s` : "—";
}

function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}
