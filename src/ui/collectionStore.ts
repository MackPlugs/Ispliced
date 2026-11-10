import { BaseDirectory } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { IN_TAURI } from "../native";
import { Collection, normalizeCollections } from "./collections";

const FILE = "collections.json";

export async function loadCollections(): Promise<Collection[]> {
  if (!IN_TAURI) return [];

  try {
    if (!await exists(FILE, { baseDir: BaseDirectory.AppConfig })) return [];
    return normalizeCollections(JSON.parse(await readTextFile(FILE, { baseDir: BaseDirectory.AppConfig })));
  } catch (error) {
    console.error("could not load collections:", error);
    return [];
  }
}

export async function saveCollections(collections: Collection[]) {
  if (!IN_TAURI) return;

  await writeTextFile(FILE, JSON.stringify(collections, null, 2), { baseDir: BaseDirectory.AppConfig });
}
