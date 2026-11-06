import { Button } from "@heroui/react";
import { Pause, Play, Volume2 } from "lucide-react";
import { usePlayer } from "../player";

export default function PlayerBar() {
  const player = usePlayer();

  if (player.track == null) return null;

  const { track, playing, progress, volume } = player;

  return (
    <div className="mt-2 flex items-center gap-4 rounded-2xl bg-surface px-4 py-2 shadow-md">
      <Button
        isIconOnly
        variant="outline"
        aria-label={playing ? "Pause preview" : "Play preview"}
        onClick={player.toggle}
      >
        {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4" fill="currentColor" />}
      </Button>

      <div className="relative min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={track.name}>{track.name}</p>
        <p className="truncate text-xs text-muted" title={track.pack}>{track.pack}</p>
        <div className="absolute inset-x-0 -bottom-1 h-0.5 overflow-hidden rounded-full bg-surface-tertiary">
          <div className="h-full rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
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
