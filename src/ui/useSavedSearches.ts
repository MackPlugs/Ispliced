import { useEffect, useState } from "react";
import { toast } from "@heroui/react";

import { errorMessage } from "../errors";
import { SavedSearch } from "./savedSearch";
import { loadSearches, saveSearches } from "./searchStore";

/** Loads and persists saved searches, keeping the file and UI in step. */
export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    loadSearches()
      .then(setSavedSearches)
      .catch(error => console.error("could not load saved searches:", error));
  }, []);

  async function save(draft: Omit<SavedSearch, "id">) {
    const saved: SavedSearch = { ...draft, id: crypto.randomUUID() };
    const next = [...savedSearches, saved];
    setSavedSearches(next);

    try {
      await saveSearches(next);
    } catch (error) {
      toast.danger("Could not save the search", { description: errorMessage(error) });
    }
  }

  async function remove(id: string) {
    const next = savedSearches.filter(search => search.id !== id);
    setSavedSearches(next);

    try {
      await saveSearches(next);
    } catch (error) {
      toast.danger("Could not delete the search", { description: errorMessage(error) });
    }
  }

  return { savedSearches, save, remove };
}
