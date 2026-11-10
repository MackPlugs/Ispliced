import { useCallback, useEffect, useState } from "react";
import { toast } from "@heroui/react";

import { Collection, addToCollection, removeFromCollection } from "./collections";
import { loadCollections, saveCollections } from "./collectionStore";
import { errorMessage } from "../errors";

/** Loads, edits and persists the user's named collections. */
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    loadCollections()
      .then(setCollections)
      .catch(error => console.error("could not load collections:", error));
  }, []);

  const update = useCallback((change: (current: Collection[]) => Collection[]) => {
    setCollections(current => {
      const next = change(current);
      void saveCollections(next).catch(error => {
        toast.danger("Could not save collections", { description: errorMessage(error) });
      });
      return next;
    });
  }, []);

  const create = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const collection: Collection = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
      paths: [],
    };

    update(current => [...current, collection]);
    return collection;
  }, [update]);

  const rename = useCallback((id: string, name: string) => {
    update(current => current.map(collection =>
      collection.id === id ? { ...collection, name } : collection));
  }, [update]);

  const remove = useCallback((id: string) => {
    update(current => current.filter(collection => collection.id !== id));
  }, [update]);

  const addPaths = useCallback((id: string, paths: string[]) => {
    update(current => current.map(collection =>
      collection.id === id ? addToCollection(collection, paths) : collection));
  }, [update]);

  const removePaths = useCallback((id: string, paths: string[]) => {
    update(current => current.map(collection =>
      collection.id === id ? removeFromCollection(collection, paths) : collection));
  }, [update]);

  return { collections, create, rename, remove, addPaths, removePaths };
}
