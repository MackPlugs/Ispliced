import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cfg, mutateCfg } from "../config";

const DEFAULT_VOLUME = 0.8;
const VOLUME_SAVE_DELAY_MS = 300;

export type PlayingTrack = {
  uuid: string;
  name: string;
  pack: string;
  durationMs: number;
};

type PlayerContextValue = {
  track: PlayingTrack | null;
  playing: boolean;
  progress: number;
  volume: number;
  play: (track: PlayingTrack, audio: Blob, startAt?: number) => Promise<void>;
  toggle: () => void;
  pause: () => void;
  seek: (fraction: number) => void;
  setVolume: (value: number) => void;
  isCurrent: (uuid: string) => boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used inside PlayerProvider");
  return player;
}

/** Owns the one preview audio element that the sample rows and the bottom bar share. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [audio] = useState(() => new Audio());
  const [track, setTrack] = useState<PlayingTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(() => clamp(cfg().volume ?? DEFAULT_VOLUME));

  const objectUrl = useRef<string | null>(null);
  const savedVolume = useRef(volume);

  useEffect(() => {
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    if (volume === savedVolume.current) return;

    const timer = setTimeout(() => {
      savedVolume.current = volume;
      void mutateCfg({ volume });
    }, VOLUME_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [volume]);

  useEffect(() => {
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [audio]);

  useEffect(() => {
    if (!playing) return;

    let frame = requestAnimationFrame(function tick() {
      setProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [audio, playing]);

  // Mirrors the old per-row behaviour: focus loss (e.g. dragging into a DAW) stops the preview.
  useEffect(() => {
    const onBlur = () => {
      audio.pause();
      setPlaying(false);
    };

    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [audio]);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const play = useCallback(async (next: PlayingTrack, blob: Blob, startAt = 0) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(blob);

    audio.src = objectUrl.current;
    setTrack(next);
    setProgress(startAt);

    await audio.play();

    if (startAt > 0) {
      const seconds = audio.duration > 0 ? audio.duration : next.durationMs / 1000;
      audio.currentTime = startAt * seconds;
    }
    setPlaying(true);
  }, [audio]);

  const pause = useCallback(() => {
    audio.pause();
    setPlaying(false);
  }, [audio]);

  const toggle = useCallback(() => {
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      pause();
    }
  }, [audio, pause]);

  const seek = useCallback((fraction: number) => {
    const seconds = audio.duration > 0 ? audio.duration : (track?.durationMs ?? 0) / 1000;
    audio.currentTime = fraction * seconds;
    setProgress(fraction);
  }, [audio, track]);

  const isCurrent = useCallback((uuid: string) => track?.uuid === uuid, [track]);

  return (
    <PlayerContext.Provider value={{
      track, playing, progress, volume,
      play, toggle, pause, seek, setVolume, isCurrent,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}
