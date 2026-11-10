import { Button, ToggleButton } from "@heroui/react";
import { ArrowLeftRight, Metronome, Pause, Play, Repeat, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { usePlayer, usePlayerProgress } from "../player";
import { MAX_BPM, MIN_BPM } from "../tempo";

export default function PlayerBar({ onPrevious, onNext, canPrevious = false, canNext = false }: {
  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;
}) {
  const player = usePlayer();
  const progress = usePlayerProgress();

  if (player.track == null) return null;

  const { track, playing, volume, tempoLock, targetBpm } = player;

  return (
    <div className="mt-2 flex items-center gap-4 rounded-2xl bg-surface px-4 py-2 shadow-md">
      <Button
        isIconOnly
        variant="outline"
        size="sm"
        aria-label="Previous sample"
        isDisabled={!canPrevious}
        onClick={onPrevious}
      >
        <SkipBack className="size-4" />
      </Button>

      <Button
        isIconOnly
        variant="outline"
        aria-label={playing ? "Pause preview" : "Play preview"}
        onClick={player.toggle}
      >
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      </Button>

      <Button
        isIconOnly
        variant="outline"
        size="sm"
        aria-label="Next sample"
        isDisabled={!canNext}
        onClick={onNext}
      >
        <SkipForward className="size-4" />
      </Button>

      <div className="relative min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={track.name}>{track.name}</p>
        <p className="truncate text-xs text-muted" title={track.pack}>
          {track.pack}{track.bpm != null ? ` · ${track.bpm} BPM` : ""}
        </p>
        <div className="absolute inset-x-0 -bottom-1 h-0.5 overflow-hidden rounded-full bg-surface-tertiary">
          <div className="h-full rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ToggleButton
          size="sm"
          isSelected={tempoLock}
          onChange={player.setTempoLock}
          isDisabled={track.bpm == null}
          aria-label={track.bpm == null
            ? "Tempo lock (this sample has no BPM)"
            : `Lock preview tempo to ${targetBpm} BPM`}
        >
          <Metronome className="size-4" />
          Tempo
        </ToggleButton>

        {tempoLock && track.bpm != null &&
          <input
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            defaultValue={targetBpm}
            aria-label="Target BPM"
            onBlur={event => player.setTargetBpm(Number(event.target.value))}
            onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
            className="w-16 rounded-md bg-surface-tertiary px-2 py-1 text-sm tabular-nums"
          />}

        <ToggleButton
          size="sm"
          isSelected={player.loop}
          onChange={player.setLoop}
          aria-label="Loop the preview"
        >
          <Repeat className="size-4" />
        </ToggleButton>

        <Button
          isIconOnly
          size="sm"
          variant="outline"
          isDisabled={player.alternate == null}
          aria-label={player.alternate ? `Switch to ${player.alternate.name}` : "Play another sample to compare"}
          onClick={player.swap}
        >
          <ArrowLeftRight className="size-4" />
        </Button>
      </div>

      <div className="flex w-40 shrink-0 items-center gap-2">
        <Volume2 className="size-4 shrink-0 text-muted" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label="Preview volume"
          onChange={event => player.setVolume(Number(event.target.value))}
          className="h-1 w-full cursor-pointer accent-accent"
        />
      </div>
    </div>
  );
}
