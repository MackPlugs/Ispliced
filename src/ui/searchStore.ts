import { BaseDirectory } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { IN_TAURI } from "../native";
import { normalizeSearch, SavedSearch } from "./savedSearch";

export type { SavedSearch } from "./savedSearch";

const FILE = "searches.json";

export async function loadSearches(): Promise<SavedSearch[]> {
  if (!IN_TAURI) return [];

  try {
    if (!await exists(FILE, { baseDir: BaseDirectory.AppConfig })) return [];

    const parsed = JSON.parse(await readTextFile(FILE, { baseDir: BaseDirectory.AppConfig }));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeSearch)
      .filter((search): search is SavedSearch => search !== null);
  } catch (error) {
    console.error("could not load saved searches:", error);
    return [];
  }
}

export async function saveSearches(searches: SavedSearch[]) {
  if (!IN_TAURI) return;

  await writeTextFile(FILE, JSON.stringify(searches, null, 2), { baseDir: BaseDirectory.AppConfig });
}
