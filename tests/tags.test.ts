import { describe, expect, it } from "vitest";
import { orderedTags } from "../src/ui/tags";

const tag = (uuid: string) => ({ uuid, label: uuid.toUpperCase() });

describe("tag ordering", () => {
  it("puts included first, then excluded, then the rest", () => {
    const ordered = orderedTags([tag("a")], [tag("b")], [tag("a"), tag("b"), tag("c")]);
    expect(ordered.map(entry => entry.uuid)).toEqual(["a", "b", "c"]);
  });

  it("does not repeat a tag that is in both lists", () => {
    const ordered = orderedTags([tag("a")], [tag("a")], [tag("a")]);
    expect(ordered.map(entry => entry.uuid)).toEqual(["a"]);
  });

  it("keeps known tags that are not selected", () => {
    const ordered = orderedTags([], [], [tag("x"), tag("y")]);
    expect(ordered.map(entry => entry.uuid)).toEqual(["x", "y"]);
  });
});
