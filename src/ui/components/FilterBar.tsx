import {
  Button, ListBox, ListBoxItem, ListBoxItemIndicator,
  Popover, PopoverContent, PopoverDialog,
  Select, SelectIndicator, SelectPopover, SelectTrigger, SelectValue,
  ToggleButton,
} from "@heroui/react";
import { ChevronDown, Disc3, Guitar, Layers, Metronome, MoveRight, Music2, Repeat } from "lucide-react";

import type { BpmFilter, BpmFilterType } from "../bpm";
import type { ChordType, MusicKey, SpliceSampleType } from "../../splice/entities";
import { FIELD_BUTTON_CLASSES, NO_PRESS_SCALE, TAG_PILL_CLASSES } from "../fieldStyles";
import BpmSelection from "./BpmSelection";
import KeyScaleSelection from "./KeyScaleSelection";

export type KnownTag = { name: string; uuid: string };

export default function FilterBar({
  knownInstruments, knownGenres,
  instruments, genres, excludedInstruments, excludedGenres,
  excludeMode, onExcludeModeChange,
  onInstrumentsChange, onGenresChange,
  musicKey, chordType, onMusicKeyChange, onChordTypeChange,
  bpm, bpmType, bpmOpen, onBpmOpenChange, onBpmChange, onBpmClear,
  sampleType, onSampleTypeChange,
}: {
  knownInstruments: KnownTag[];
  knownGenres: KnownTag[];
  instruments: string[];
  genres: string[];
  excludedInstruments: string[];
  excludedGenres: string[];
  excludeMode: boolean;
  onExcludeModeChange: (enabled: boolean) => void;
  onInstrumentsChange: (values: string[]) => void;
  onGenresChange: (values: string[]) => void;
  musicKey: MusicKey | null;
  chordType: ChordType | null;
  onMusicKeyChange: (key: MusicKey | null) => void;
  onChordTypeChange: (chord: ChordType | null) => void;
  bpm: BpmFilter | undefined;
  bpmType: BpmFilterType;
  bpmOpen: boolean;
  onBpmOpenChange: (open: boolean) => void;
  onBpmChange: (type: BpmFilterType, bpm: BpmFilter) => void;
  onBpmClear: () => void;
  sampleType: SpliceSampleType | "any";
  onSampleTypeChange: (type: SpliceSampleType | "any") => void;
}) {
  const excludedNames = namesOf(excludedInstruments, knownInstruments)
    .concat(namesOf(excludedGenres, knownGenres));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <ToggleButton size="sm" className={TAG_PILL_CLASSES}
          isSelected={excludeMode}
          onChange={onExcludeModeChange}
          aria-label="Exclude the selected instruments, genres and tags"
        >Exclude</ToggleButton>

        <Select aria-label={excludeMode ? "Excluded instruments" : "Instruments"}
          selectionMode="multiple"
          placeholder={excludeMode ? "Exclude instruments" : "Instruments"}
          value={instruments}
          onChange={values => onInstrumentsChange(values as string[])}
          className="flex-1 min-w-0"
          fullWidth
        >
          <SelectTrigger className="max-w-full">
            <Guitar className="size-4 me-2 self-center shrink-0 text-muted" />
            <SelectValue className="truncate" />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover>
            <ListBox items={knownInstruments}>
              {(item: KnownTag) => <ListBoxItem id={item.uuid} textValue={item.name}>{item.name}<ListBoxItemIndicator /></ListBoxItem>}
            </ListBox>
          </SelectPopover>
        </Select>

        <Select aria-label={excludeMode ? "Excluded genres" : "Genres"}
          selectionMode="multiple"
          placeholder={excludeMode ? "Exclude genres" : "Genres"}
          value={genres}
          onChange={values => onGenresChange(values as string[])}
          className="flex-1 min-w-0"
          fullWidth
        >
          <SelectTrigger className="max-w-full">
            <Disc3 className="size-4 me-2 self-center shrink-0 text-muted" />
            <SelectValue className="truncate" />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover>
            <ListBox items={knownGenres}>
              {(item: KnownTag) => <ListBoxItem id={item.uuid} textValue={item.name}>{item.name}<ListBoxItemIndicator /></ListBoxItem>}
            </ListBox>
          </SelectPopover>
        </Select>

        <Popover>
          <Button variant="outline" className={`${FIELD_BUTTON_CLASSES} flex-1 min-w-0 group ${NO_PRESS_SCALE}`}>
            <Music2 className="size-4 shrink-0 text-muted" />
            <span className="flex-1 truncate text-left">
              {(musicKey == null && chordType == null) ? "Key"
                : `${musicKey ?? ""}${chordType == null ? "" : chordType == "major" ? " Major" : " Minor"}`}
            </span>
            <ChevronDown className="size-4 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-180" />
          </Button>

          <PopoverContent placement="bottom">
            <PopoverDialog className="flex p-6">
              <KeyScaleSelection
                onChordSet={onChordTypeChange} onKeySet={onMusicKeyChange}
                selectedChord={chordType} selectedKey={musicKey}
              />
            </PopoverDialog>
          </PopoverContent>
        </Popover>

        <Popover isOpen={bpmOpen} onOpenChange={onBpmOpenChange}>
          <Button variant="outline" className={`${FIELD_BUTTON_CLASSES} flex-1 min-w-0 group ${NO_PRESS_SCALE}`}>
            <Metronome className="size-4 shrink-0 text-muted" />
            <span className="flex-1 truncate text-left">
              {(bpmType == "exact" && bpm?.bpm
                ? `${bpm?.bpm} BPM`
                : bpmType == "range" && bpm?.maxBpm && bpm.minBpm
                  ? `${bpm.minBpm} – ${bpm.maxBpm} BPM`
                  : "BPM"
              )}
            </span>
            <ChevronDown className="size-4 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-180" />
          </Button>

          <PopoverContent placement="bottom">
            <PopoverDialog className="p-6">
              <BpmSelection
                bpmType={bpmType}
                bpm={bpm}
                onSave={onBpmChange}
                onClear={onBpmClear}
              />
            </PopoverDialog>
          </PopoverContent>
        </Popover>

        <Select aria-label="Type"
          value={sampleType}
          onChange={value => onSampleTypeChange(value as SpliceSampleType | "any")}
          className="flex-1 min-w-0"
        >
          <SelectTrigger>
            <Layers className="size-4 me-2 self-center shrink-0 text-muted" />
            { /* Render only the label here; the per-item icons belong in the dropdown. */ }
            <SelectValue>{({ selectedText }) => selectedText}</SelectValue>
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover>
            <ListBox>
              <ListBoxItem id="any" textValue="Any">
                <span className="size-4 shrink-0" aria-hidden="true" />
                Any<ListBoxItemIndicator />
              </ListBoxItem>
              <ListBoxItem id="oneshot" textValue="One-Shots">
                <MoveRight className="size-4 shrink-0 text-muted" />
                One-Shots<ListBoxItemIndicator />
              </ListBoxItem>
              <ListBoxItem id="loop" textValue="Loops">
                <Repeat className="size-4 shrink-0 text-muted" />
                Loops<ListBoxItemIndicator />
              </ListBoxItem>
            </ListBox>
          </SelectPopover>
        </Select>
      </div>

      {excludedNames.length > 0 &&
        <div className="flex flex-wrap items-center gap-1.5 ps-1 text-sm">
          <span className="text-muted">Excluding</span>
          {excludedNames.map(name => <span key={name} className="line-through text-danger">{name}</span>)}
        </div>}
    </div>
  );
}

function namesOf(uuids: string[], known: KnownTag[]) {
  return uuids.map(uuid => known.find(tag => tag.uuid === uuid)?.name ?? uuid);
}
