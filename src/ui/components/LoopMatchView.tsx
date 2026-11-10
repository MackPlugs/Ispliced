import { useEffect, useState } from "react";
import {
  Button, ListBox, ListBoxItem, ListBoxItemIndicator,
  Select, SelectIndicator, SelectPopover, SelectTrigger, SelectValue,
} from "@heroui/react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Upload } from "lucide-react";

import { errorMessage } from "../../errors";
import { IN_TAURI, LocalLoopAnalysis, analyzeLocalLoop } from "../../native";
import {
  LoopMatch, MatchTolerance, SUPPORTED_LOOP_EXTENSIONS, isSupportedLoopFile, loopFileName,
} from "../loopMatch";

/**
 * Lets the user drop or choose a local loop, detects its key and tempo, then
 * hands a catalogue search back to the browse view.
 */
export default function LoopMatchView({ onMatch }: { onMatch: (match: LoopMatch) => void }) {
  const [analysis, setAnalysis] = useState<LocalLoopAnalysis | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [tolerance, setTolerance] = useState<MatchTolerance>("near");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IN_TAURI) return;

    let disposed = false;
    let stop: (() => void) | undefined;

    void getCurrentWebview().onDragDropEvent(event => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDragging(true);
      } else if (event.payload.type === "drop") {
        setDragging(false);
        const path = event.payload.paths[0];
        if (path != null) void analyse(path);
      } else {
        setDragging(false);
      }
    }).then(unlisten => {
      if (disposed) unlisten();
      else stop = unlisten;
    });

    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  async function analyse(path: string) {
    if (!isSupportedLoopFile(path)) {
      setAnalysis(null);
      setBpm(null);
      setError(`Loop matching currently supports WAV files. Convert ${loopFileName(path)} to WAV and try again.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await analyzeLocalLoop(path);
      setAnalysis(result);
      setBpm(result.bpm);
    } catch (err) {
      setAnalysis(null);
      setBpm(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile() {
    if (!IN_TAURI) {
      setError("Loop matching needs the desktop application.");
      return;
    }

    const path = await open({
      multiple: false,
      filters: [{ name: "WAV audio", extensions: SUPPORTED_LOOP_EXTENSIONS }],
    });

    if (typeof path === "string") await analyse(path);
  }

  return (
    <div className="mt-2 flex flex-1 min-h-0 flex-col gap-3">
      <button
        type="button"
        onClick={chooseFile}
        aria-label="Drop or choose a WAV loop to catalogue match"
        className={`flex flex-1 min-h-48 flex-col items-center justify-center gap-3 rounded-3xl
                    border-2 border-dashed px-8 text-center transition-colors cursor-pointer
                    ${dragging ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-secondary"}`}
      >
        <Upload className={`size-10 ${dragging ? "text-accent" : "text-muted"}`} />
        <span className="text-lg font-medium">
          {busy ? "Analysing the loop…" : "Drop or upload a WAV loop here to catalogue match"}
        </span>
        <span className="text-sm text-muted">
          Click to choose a .wav file. Its key and tempo are detected on your machine.
        </span>
      </button>

      {error != null && <p className="text-sm text-danger">{error}</p>}

      {analysis != null &&
        <div className="flex flex-wrap items-end gap-4 rounded-3xl bg-surface p-5 shadow-md">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" title={analysis.path}>{analysis.name}</p>
            <p className="text-sm text-muted">
              {analysis.key ?? "Key not detected"} · {formatDuration(analysis.durationMs)}
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted">
            BPM
            <input
              type="number"
              min={1}
              max={300}
              value={bpm ?? ""}
              onChange={event => setBpm(event.target.value === "" ? null : Number(event.target.value))}
              aria-label="Detected BPM"
              className="w-24 rounded-md bg-surface-tertiary px-2 py-1 text-sm tabular-nums text-foreground"
            />
          </label>

          <Select
            aria-label="Tempo tolerance"
            value={tolerance}
            onChange={value => setTolerance(value as MatchTolerance)}
            className="w-44"
          >
            <SelectTrigger>
              <SelectValue />
              <SelectIndicator />
            </SelectTrigger>
            <SelectPopover>
              <ListBox>
                <ListBoxItem id="exact" textValue="Exact tempo">Exact tempo<ListBoxItemIndicator /></ListBoxItem>
                <ListBoxItem id="near" textValue="Within 2 BPM">Within 2 BPM<ListBoxItemIndicator /></ListBoxItem>
                <ListBoxItem id="half" textValue="Half time">Half time<ListBoxItemIndicator /></ListBoxItem>
                <ListBoxItem id="double" textValue="Double time">Double time<ListBoxItemIndicator /></ListBoxItem>
              </ListBox>
            </SelectPopover>
          </Select>

          <Button isDisabled={bpm == null}
            onClick={() => onMatch({ bpm, key: analysis.key, tolerance })}>
            <FolderOpen className="size-4" />
            Find matching samples
          </Button>
        </div>}
    </div>
  );
}

function formatDuration(ms: number) {
  return ms ? `${(ms / 1000).toFixed(2)}s` : "length unknown";
}
