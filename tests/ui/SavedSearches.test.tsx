import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SavedSearches from "../../src/ui/components/SavedSearches";
import { SavedSearch } from "../../src/ui/savedSearch";

const saved: SavedSearch = {
  id: "1",
  name: "Trap drums",
  view: "samples",
  query: "trap",
  sortBy: "popularity",
  bpm: null,
  bpmType: "exact",
  sampleType: "any",
  instruments: [],
  genres: [],
  tags: [],
  excludedTags: [],
  musicKey: null,
  chordType: null,
  packFilter: null,
};

async function openSearches(searches: SavedSearch[], handlers = {}) {
  const onSave = vi.fn();
  const onLoad = vi.fn();
  const onDelete = vi.fn();

  render(
    <SavedSearches
      searches={searches}
      onSave={onSave}
      onLoad={onLoad}
      onDelete={onDelete}
      {...handlers}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "Saved searches" }));
  return { onSave, onLoad, onDelete };
}

describe("SavedSearches", () => {
  it("saves the typed name and clears the input", async () => {
    const { onSave } = await openSearches([]);

    const input = screen.getByLabelText("Saved search name");
    await userEvent.type(input, "Trap drums");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith("Trap drums");
    expect(input).toHaveValue("");
  });

  it("does not save an empty name", async () => {
    const { onSave } = await openSearches([]);

    await userEvent.type(screen.getByLabelText("Saved search name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("loads and deletes stored searches", async () => {
    const { onLoad, onDelete } = await openSearches([saved]);

    await userEvent.click(screen.getByRole("button", { name: "Trap drums" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Trap drums" }));

    expect(onLoad).toHaveBeenCalledWith(saved);
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
