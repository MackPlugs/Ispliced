import { Chip, ProgressCircle, ProgressCircleFillCircle, ProgressCircleTrack, ProgressCircleTrackCircle, Tooltip, TooltipContent, TooltipTrigger, toast } from "@heroui/react";
import { Clock, Metronome, Music2, Pause, Play } from "lucide-react";

import { fetch } from "@tauri-apps/plugin-http";
import { useRef, useState } from "react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";

import { checkDirExists, checkFileExists, createPlaceholder, IN_TAURI, IS_WINDOWS, WINDOWS_MAX_PATH, writeSampleFile } from "../../native";
import { join } from "@tauri-apps/api/path";

import { cfg } from "../../config";
import { DRAG_PREVIEW_ICON } from "../../dragIcon";
import { PlayingTrack, usePlayer } from "../player";
import { SpliceTag } from "../../splice/entities";
import { SpliceSample, SpliceSamplePack } from "../../splice/api";
import { decodeSpliceAudio } from "../../splice/decoder";
import { decodeToWav } from "../../splice/export";
import { sampleFileName, samplePath } from "../../splice/samplePath";
import Waveform from "./Waveform";

const getChordTypeDisplay = (type: string | null) =>
  type == null ? "" : type == "major" ? " Major" : " Minor";

export type TagClickHandler = (tag: SpliceTag) => void;
export type PackClickHandler = (pack: SpliceSamplePack) => void;

/**
 * The shortest candidate path that fits the Windows shell, preferring the full one.
 * Returns `null` when even the bare file name is too long.
 */
async function resolveDragPath(pack: SpliceSamplePack, sample: SpliceSample, sampleDir: string) {
  const candidates = [samplePath(pack, sample), samplePath(pack, sample, "pack"), sampleFileName(sample)];

  for (const candidate of candidates) {
    const fullPath = await join(sampleDir, candidate);
    if (!IS_WINDOWS || fullPath.length <= WINDOWS_MAX_PATH) return { relativePath: candidate, fullPath };
  }

  return null;
}

function trackOf(sample: SpliceSample, pack: SpliceSamplePack): PlayingTrack {
  return {
    uuid: sample.uuid,
    name: sample.name.split("/").pop() ?? sample.name,
    pack: pack.name,
    durationMs: sample.duration,
  };
}

/**
 * Provides a view describing a Splice sample.
 */
export default function SampleListEntry(
  { sample, onTagClick, onPackClick }: {
    sample: SpliceSample,
    onTagClick: TagClickHandler,
    onPackClick: PackClickHandler
  }
) {
  const player = usePlayer();
  const isCurrent = player.isCurrent(sample.uuid);
  const playing = isCurrent && player.playing;
  const [fgLoading, setFgLoading] = useState(false);

  const pack = sample.parents.items[0];
  const packCover = pack
    ? pack.files.find(x => x.asset_file_type_slug == "cover_image")?.url
    : "img/missing-cover.png";

  const waveformUrl = sample.files.find(x => x.asset_file_type_slug == "waveform")?.url;

  const decodedSample = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const fetchAhead = useRef<Promise<Response> | null>(null);
  function startFetching() {
    if (!IN_TAURI) return; // Browser fixtures contain no playable preview audio.
    if (fetchAhead.current != null)
      return;

    const file = sample.files.find(x => x.asset_file_type_slug == "preview_mp3")!;

    fetchAhead.current = fetch(file.url);
  }

  async function startPreview(startAt = 0) {
    setFgLoading(true);
    try {
      await ensureAudioDecoded();
      await player.play(trackOf(sample, pack), new Blob([decodedSample.current!], { type: "audio/mpeg" }), startAt);
      return true;
    } catch (err) {
      console.error("failed to load sample preview:", err);
      return false;
    } finally {
      setFgLoading(false);
    }
  }

  async function handlePlayClick() {
    if (!IN_TAURI) return;
    if (isCurrent) player.toggle();
    else await startPreview();
  }

  async function handleSeek(target: number) {
    if (!IN_TAURI) return;
    if (isCurrent) player.seek(target);
    else await startPreview(target);
  }

  async function ensureAudioDecoded() {
    if (decodedSample.current != null)
      return;

    if (fetchAhead.current == null) {
      startFetching();
    }

    const resp = await fetchAhead.current!;
    const data = await resp.arrayBuffer();
    decodedSample.current = decodeSpliceAudio(new Uint8Array(data));
  }

  async function handleDrag(ev: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!IN_TAURI) return;
    // Verify that the parent of the element that we began the dragging from
    // is not explicitly marked as non-draggable (as it may be clicked etc.)
    const dragOrigin = document.elementFromPoint(ev.clientX, ev.clientY)?.parentElement;
    if (dragOrigin != null && dragOrigin.dataset.draggable === "false") {
      return;
    }

    const { sampleDir, placeholders, trimDelay } = cfg();

    if (!await checkDirExists(sampleDir)) {
      toast.danger("Sample folder not found", {
        description: "Choose an existing sample folder in the settings to drag samples into your DAW."
      });
      return;
    }

    // Windows' shell can't drag files past MAX_PATH - the drag plugin crashes
    // the whole app if we try, so fall back to shorter layouts.
    const target = await resolveDragPath(pack, sample, sampleDir);
    if (target == null) {
      toast.danger("Can't drag this sample", {
        description: "The path to your sample folder is too long for Windows. Choose a shorter one in the settings."
      });
      return;
    }

    const dragParams = { item: [target.fullPath], icon: DRAG_PREVIEW_ICON };

    setFgLoading(true);
    try {
      await ensureAudioDecoded();

      if (await checkFileExists(sampleDir, target.relativePath)) {
        startDrag(dragParams);
        return;
      }

      // A placeholder lets the drag start before the WAV has been written.
      if (placeholders) {
        await createPlaceholder(sampleDir, target.relativePath);
        startDrag(dragParams);
      }

      const wavBuffer = await decodeToWav(decodedSample.current!, sample.duration, trimDelay);
      await writeSampleFile(sampleDir, target.relativePath, wavBuffer);

      if (!placeholders) startDrag(dragParams);
    } catch (err) {
      console.error("failed to prepare sample for dragging:", err);
    } finally {
      setFgLoading(false);
    }
  }

  return (
    <div onMouseOver={startFetching}
      className={`group flex w-full px-3 py-2 gap-6 rounded-2xl transition-colors
                    items-center hover:bg-surface-secondary cursor-grab select-none`}
    >
      { /* when loading, set the cursor for everything to a waiting icon */}
      {fgLoading && <style> {`* { cursor: wait }`} </style>}

      { /* pack cover + play/stop control */}
      <div className="flex items-center gap-3 shrink-0">
        <Tooltip>
          <TooltipTrigger>
            <button
              type="button"
              onClick={() => onPackClick(pack)}
              aria-label={`Show samples from ${pack.name}`}
              data-draggable="false"
              className="cursor-pointer"
            >
              <img
                src={packCover} alt={pack.name}
                width={36} height={36}
                className="rounded-sm object-cover"
                draggable={false}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col gap-2 p-3 max-w-40">
              <img src={packCover} alt={pack.name} width={128} height={128} className="rounded-lg" />
              <span className="text-sm font-medium">{pack.name}</span>
              <span className="text-xs text-muted text-balance">Click to show samples from this pack</span>
            </div>
          </TooltipContent>
        </Tooltip>

        <button
          type="button"
          onClick={handlePlayClick}
          aria-label={playing ? "Pause sample" : "Play sample"}
          data-draggable="false"
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0
                      cursor-pointer transition-colors hover:bg-surface-tertiary
                      ${playing ? "text-accent" : "text-current"}`}
        >
          {fgLoading
            ? <ProgressCircle aria-label="Loading sample..." className="h-6" isIndeterminate>
                <ProgressCircleTrack>
                  <ProgressCircleTrackCircle />
                  <ProgressCircleFillCircle />
                </ProgressCircleTrack>
              </ProgressCircle>
            : playing
              ? <Pause className="size-4" fill="currentColor" />
              : <Play className="size-4" fill="currentColor" />}
        </button>
      </div>

      { /* sample name + tags */}
      <div className="flex-1 min-w-0 space-y-1" onMouseDown={handleDrag}>
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="truncate">{sample.name.split("/").pop()}</span>
          <span className="text-sm text-muted shrink-0">
            {sample.asset_category_slug == "oneshot" ? "one-shot" : "loop"}
          </span>
        </div>

        <div className="flex gap-1 overflow-hidden">{sample.tags.map(x => (
          <Chip key={x.uuid}
            size="sm" className="cursor-pointer shrink-0"
            onClick={() => onTagClick(x)}
            data-draggable="false"
          >
            {x.label}
          </Chip>
        ))}</div>
      </div>

      { /* waveform preview */}
      {waveformUrl &&
        <Waveform
          src={waveformUrl}
          progress={isCurrent ? player.progress : 0}
          onSeek={handleSeek}
          className="w-40 h-10 shrink-0"
        />}

      { /* other metadata */}
      <div className="grid grid-cols-3 gap-2 w-64 shrink-0 text-sm text-muted tabular-nums"
        onMouseDown={handleDrag}
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap" title="Key">
          <Music2 className="size-4 shrink-0" />
          <span>
            {sample.key != null
              ? `${sample.key.toUpperCase()}${getChordTypeDisplay(sample.chord_type)}`
              : "—"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 whitespace-nowrap" title="Duration">
          <Clock className="size-4 shrink-0" />
          <span>{`${(sample.duration / 1000).toFixed(2)}s`}</span>
        </div>

        <div className="flex items-center gap-1.5 whitespace-nowrap" title="Tempo">
          <Metronome className="size-4 shrink-0" />
          <span>{sample.bpm != null ? `${sample.bpm} BPM` : "—"}</span>
        </div>
      </div>
    </div>
  );
}
