import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SpliceTag } from "../../src/splice/entities";
import TagFilters from "../../src/ui/components/TagFilters";

const drums: SpliceTag = { uuid: "1", label: "drums" } as SpliceTag;
const trap: SpliceTag = { uuid: "2", label: "trap" } as SpliceTag;

function renderFilters(overrides: Partial<Parameters<typeof TagFilters>[0]> = {}) {
  const onToggleTag = vi.fn();
  const onExpandedChange = vi.fn();

  render(
    <TagFilters
      tags={[]}
      excludedTags={[]}
      knownTags={[drums, trap]}
      expanded={false}
      onToggleTag={onToggleTag}
      onExpandedChange={onExpandedChange}
      {...overrides}
    />,
  );

  return { onToggleTag, onExpandedChange };
}

describe("TagFilters", () => {
  it("reports the clicked tag", async () => {
    const { onToggleTag } = renderFilters();

    await userEvent.click(screen.getByRole("button", { name: "drums" }));

    expect(onToggleTag).toHaveBeenCalledWith(drums);
  });

  it("pins selected tags to the front", () => {
    renderFilters({ tags: [trap] });

    expect(screen.getAllByRole("button")[0]).toHaveTextContent("trap");
  });

  it("marks excluded tags as selected and struck through", () => {
    renderFilters({ excludedTags: [drums] });

    const pill = screen.getByRole("button", { name: "drums" });
    expect(pill).toHaveClass("line-through");
    expect(pill).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the expanded state", async () => {
    const { onExpandedChange } = renderFilters();

    await userEvent.click(screen.getByRole("button", { name: "Show all tags" }));

    expect(onExpandedChange).toHaveBeenCalled();
  });
});
