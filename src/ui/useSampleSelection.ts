import { useState } from "react";

/** Which catalogue results are ticked for a batch download. */
export function useSampleSelection() {
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(new Set());

  function toggle(uuid: string) {
    setSelectedSamples(current => {
      const next = new Set(current);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }

  function clear() {
    setSelectedSamples(new Set());
  }

  return { selectedSamples, toggle, clear };
}
