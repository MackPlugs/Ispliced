import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { cfg, mutateCfg } from "../config";
import { DEFAULT_BPM, clampBpm, tempoRate } from "./tempo";
import { getPlayerProgress, setPlayerProgress, subscribeToProgress } from "./playerClock";
import { fractionOf, resumeFraction } from "./playbackPosition";

const DEFAULT_VOLUME = 0.8;
const SETTINGS_SAVE_DELAY_MS = 300;

export type PlayingTrack = {
  uuid: string;
  name: string;
  pack: string;
  durationMs: number;
  bpm: number | null;
};

type PlayerContextValue = {
  track: PlayingTrack | null;
  playing: boolean;
  volume: number;
  tempoLock: boolean;
  targetBpm: number;
  loop: boolean;
  alternate: PlayingTrack | null;
  play: (track: PlayingTrack, audio: Blob, startAt?: number) => Promise<void>;
  toggle: () => void;
  pause: () => void;
  seek: (fraction: number) => void;
  setVolume: (value: number) => void;
  setTempoLock: (enabled: boolean) => void;
  setTargetBpm: (bpm: number) => void;
  setLoop: (enabled: boolean) => void;
  swap: () => void;
  isCurrent: (uuid: string) => boolean;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used inside PlayerProvider");
  return player;
}

/**
 * Playback progress from the shared clock. Components that pass `active: false`
 * keep a constant snapshot, so the 60 fps tick does not re-render them.
 */
export function usePlayerProgress(active = true) {
  return useSyncExternalStore(
    subscribeToProgress,
    () => (active ? getPlayerProgress() : 0),
  );
}

/** Owns the one preview audio element that the sample rows and the bottom bar share. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [audio] = useState(() => new Audio());
  const [track, setTrack] = useState<PlayingTrack | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => clamp(cfg().volume ?? DEFAULT_VOLUME));
  const [tempoLock, setTempoLock] = useState(() => cfg().tempoLock);
  const [targetBpm, setTargetBpmState] = useState(() => clampBpm(cfg().targetBpm ?? DEFAULT_BPM));
  const [loop, setLoop] = useState(false);
  const [alternate, setAlternate] = useState<PlayingTrack | null>(null);

  const objectUrl = useRef<string | null>(null);
  const currentBlob = useRef<Blob | null>(null);
  const alternateTrack = useRef<{ track: PlayingTrack; blob: Blob; position: number } | null>(null);
  const savedVolume = useRef(volume);
  const savedTempo = useRef({ tempoLock, targetBpm });

  useEffect(() => {
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    audio.loop = loop;
  }, [audio, loop]);

  useEffect(() => {
    audio.preservesPitch = true;
  }, [audio]);

  useEffect(() => {
    audio.playbackRate = tempoRate(track?.bpm ?? null, targetBpm, tempoLock);
  }, [audio, track, targetBpm, tempoLock]);

  useEffect(() => {
    if (volume === savedVolume.current) return;

    const timer = setTimeout(() => {
      savedVolume.current = volume;
      void mutateCfg({ volume }).catch(error => console.error("could not save the volume:", error));
    }, SETTINGS_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [volume]);

  useEffect(() => {
    if (savedTempo.current.tempoLock === tempoLock && savedTempo.current.targetBpm === targetBpm) return;

    const timer = setTimeout(() => {
      savedTempo.current = { tempoLock, targetBpm };
      void mutateCfg({ tempoLock, targetBpm })
        .catch(error => console.error("could not save the tempo settings:", error));
    }, SETTINGS_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [tempoLock, targetBpm]);

  useEffect(() => {
    const onEnded = () => {
      setPlaying(false);
      setPlayerProgress(0);
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [audio]);

  useEffect(() => {
    if (!playing) return;

    let frame = requestAnimationFrame(function tick() {
      setPlayerProgress(audio.duration > 0 ? audio.currentTime / audio.duration : 0);
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

  const currentFraction = useCallback(
    () => fractionOf(audio.currentTime, audio.duration, getPlayerProgress()),
    [audio],
  );

  const start = useCallback(async (next: PlayingTrack, blob: Blob, startAt = 0) => {
    const position = resumeFraction(startAt);

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(blob);

    audio.src = objectUrl.current;
    audio.playbackRate = tempoRate(next.bpm, targetBpm, tempoLock);
    setTrack(next);
    setPlayerProgress(position);

    await audio.play();

    if (position > 0) {
      const seconds = audio.duration > 0 ? audio.duration : next.durationMs / 1000;
      audio.currentTime = position * seconds;
    }
    setPlaying(true);
  }, [audio, targetBpm, tempoLock]);

  const play = useCallback(async (next: PlayingTrack, blob: Blob, startAt = 0) => {
    if (track && track.uuid !== next.uuid && currentBlob.current) {
      alternateTrack.current = { track, blob: currentBlob.current, position: currentFraction() };
      setAlternate(track);
    }

    currentBlob.current = blob;
    await start(next, blob, startAt);
  }, [start, track, currentFraction]);

  const swap = useCallback(() => {
    const other = alternateTrack.current;
    if (!other) return;

    const current = track && currentBlob.current
      ? { track, blob: currentBlob.current, position: currentFraction() }
      : null;
    alternateTrack.current = current;
    setAlternate(current?.track ?? null);

    currentBlob.current = other.blob;
    void start(other.track, other.blob, other.position)
      .catch(error => console.error("could not swap the preview:", error));
  }, [start, track, currentFraction]);

  const pause = useCallback(() => {
    audio.pause();
    setPlaying(false);
  }, [audio]);

  const toggle = useCallback(() => {
    if (audio.paused) {
      void audio.play().catch(error => console.error("could not resume the preview:", error));
      setPlaying(true);
    } else {
      pause();
    }
  }, [audio, pause]);

  const seek = useCallback((fraction: number) => {
    const seconds = audio.duration > 0 ? audio.duration : (track?.durationMs ?? 0) / 1000;
    audio.currentTime = fraction * seconds;
    setPlayerProgress(fraction);
  }, [audio, track]);

  const isCurrent = useCallback((uuid: string) => track?.uuid === uuid, [track]);
  const setTargetBpm = useCallback((value: number) => setTargetBpmState(clampBpm(value)), []);

  const value = useMemo(() => ({
    track, playing, volume,
    tempoLock, targetBpm, setTempoLock, setTargetBpm,
    loop, setLoop, alternate, swap,
    play, toggle, pause, seek, setVolume, isCurrent,
  }), [track, playing, volume, tempoLock, targetBpm, loop, alternate, play, toggle, pause, seek, isCurrent, swap, setTargetBpm]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}
