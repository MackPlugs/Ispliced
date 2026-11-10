import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import FilterBar from "../../src/ui/components/FilterBar";

function renderBar(overrides: Partial<ComponentProps<typeof FilterBar>> = {}) {
  const onExcludeModeChange = vi.fn();
  const onInstrumentsChange = vi.fn();
  const onGenresChange = vi.fn();

  render(
    <FilterBar
      knownInstruments={[{ name: "Drums", uuid: "u1" }]}
      knownGenres={[{ name: "Trap", uuid: "u2" }]}
      instruments={[]}
      genres={[]}
      excludedInstruments={[]}
      excludedGenres={[]}
      excludeMode={false}
      onExcludeModeChange={onExcludeModeChange}
      onInstrumentsChange={onInstrumentsChange}
      onGenresChange={onGenresChange}
      musicKey={null}
      chordType={null}
      onMusicKeyChange={vi.fn()}
      onChordTypeChange={vi.fn()}
      bpm={undefined}
      bpmType="exact"
      bpmOpen={false}
      onBpmOpenChange={vi.fn()}
      onBpmChange={vi.fn()}
      onBpmClear={vi.fn()}
      sampleType="any"
      onSampleTypeChange={vi.fn()}
      {...overrides}
    />,
  );

  return { onExcludeModeChange };
}

describe("FilterBar", () => {
  it("toggles the exclusion mode", async () => {
    const { onExcludeModeChange } = renderBar();

    await userEvent.click(screen.getByRole("button", { name: "Exclude the selected instruments, genres and tags" }));

    expect(onExcludeModeChange).toHaveBeenCalled();
  });

  it("labels the selects for exclusion while the mode is on", () => {
    renderBar({ excludeMode: true });

    expect(screen.getByRole("button", { name: /Excluded instruments/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluded genres/ })).toBeInTheDocument();
  });

  it("lists what is being excluded", () => {
    renderBar({ excludeMode: true, excludedInstruments: ["u1"], excludedGenres: ["u2"] });

    expect(screen.getByText("Excluding")).toBeInTheDocument();
    expect(screen.getAllByText("Drums").some(chip => chip.classList.contains("line-through"))).toBe(true);
    expect(screen.getAllByText("Trap").some(chip => chip.classList.contains("line-through"))).toBe(true);
  });
});
