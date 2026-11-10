import { describe, expect, it } from "vitest";
import {
  addToCollection, missingPaths, normalizeCollection, normalizeCollections, removeFromCollection,
} from "../src/ui/collections";

const collection = {
  id: "c1",
  name: "Favourites",
  createdAt: 10,
  paths: ["a.wav", "b.wav"],
};

describe("collections", () => {
  it("normalises a stored collection", () => {
    expect(normalizeCollection(collection)).toEqual(collection);
  });

  it("drops entries without an id or name", () => {
    expect(normalizeCollection({ name: "No id" })).toBeNull();
    expect(normalizeCollection({ id: "1" })).toBeNull();
    expect(normalizeCollections("nope")).toEqual([]);
  });

  it("filters non-string paths", () => {
    expect(normalizeCollection({ ...collection, paths: ["a.wav", 3, null] })?.paths).toEqual(["a.wav"]);
  });

  it("adds paths once", () => {
    const next = addToCollection(collection, ["b.wav", "c.wav"]);
    expect(next.paths).toEqual(["a.wav", "b.wav", "c.wav"]);
  });

  it("removes paths", () => {
    expect(removeFromCollection(collection, ["a.wav"]).paths).toEqual(["b.wav"]);
  });

  it("reports paths missing from the index", () => {
    expect(missingPaths(collection, new Set(["a.wav"]))).toEqual(["b.wav"]);
  });
});
