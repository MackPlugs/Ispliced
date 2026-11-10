type Listener = () => void;

let progress = 0;
const listeners = new Set<Listener>();

/** Playback progress lives outside React so only opted-in subscribers re-render. */
export function setPlayerProgress(value: number) {
  if (value === progress) return;

  progress = value;
  for (const listener of listeners) listener();
}

export function subscribeToProgress(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlayerProgress() {
  return progress;
}
