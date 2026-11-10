import { invoke } from '@tauri-apps/api/core';

/**
 * Whether the app is running inside the Tauri shell. When `false` (e.g. when
 * running `yarn dev` in a plain browser for UI work), native functionality is
 * unavailable and the app falls back to in-memory config and mock search data.
 */
export const IN_TAURI = "__TAURI_INTERNALS__" in window;

/** Whether the app is running on Windows. */
export const IS_WINDOWS = navigator.userAgent.includes("Windows");

/**
 * The longest path (in UTF-16 code units, excluding the null terminator) that the
 * Windows shell accepts. Dragging files with longer paths isn't possible.
 */
export const WINDOWS_MAX_PATH = 259;

/**
 * Writes a file to the path retrieved by combining `baseDir` and `relativePath`.
 * The path is required to end with ".wav".
 */
// /src-tauri/src/files.rs
export async function writeSampleFile(baseDir: string, relativePath: string, buffer: Buffer) {
  await invoke("write_sample_file", {
    baseDir,
    relativePath,
    buffer: Array.from(buffer)
  });
}

/**
 * Checks if a file exists on the path retrieved by combining `baseDir` and `relativePath`.
 */
// /src-tauri/src/files.rs
export async function checkFileExists(baseDir: string, relativePath: string) {
  return invoke<boolean>("file_exists", {
    baseDir,
    relativePath
  });
}

/**
 * Checks if `path` points to an existing directory. Always `true` outside of Tauri.
 */
// /src-tauri/src/files.rs
export async function checkDirExists(path: string) {
  if (!IN_TAURI)
    return true;

  return invoke<boolean>("dir_exists", { path });
}

/**
 * Creates an empty placeholder file on the path retrieved by combining "baseDir" and "relativePath".
 */
// /src-tauri/src/files.rs
export async function createPlaceholder(baseDir: string, relativePath: string) {
  await invoke("create_placeholder_file", {
    baseDir,
    relativePath
  });
}

/** The key K10 detected in one loop. */
export type DetectedKey = {
  tonic: number;
  mode: "maj" | "min";
  label: string;
  confidence: "low" | "medium" | "high";
  probability: number;
};

/** One loop the labeller could rename, or the reason it was skipped. */
export type LabelProposal = {
  path: string;
  name: string;
  newName: string;
  label: string;
  confidence: DetectedKey["confidence"];
  probability: number;
  reason: string;
};

export type LabelReport = {
  renamed: string[];
  failed: { path: string; reason: string }[];
};

/** Proposes names for the loops in a downloaded pack; nothing is renamed. */
export async function planLoopLabels(folder: string, minConfidence: string) {
  return invoke<LabelProposal[]>("plan_loop_labels", { folder, minConfidence });
}

/** Applies the proposals the user accepted. */
export async function applyLoopLabels(pairs: { path: string; newName: string }[]) {
  return invoke<LabelReport>("apply_loop_labels", { pairs });
}

/** One audio file in the user's sample folder. */
export type LibraryEntry = {
  path: string;
  name: string;
  pack: string;
  instrument: string;
  kind: "loop" | "one-shot" | "other";
  bpm: number | null;
  key: string | null;
  durationMs: number;
  bytes: number;
  favorite: boolean;
  modified: number;
  hash: string | null;
  /** Base64 spectral profile used by find_similar; opaque to the UI. */
  embedding: string | null;
};

export type LibraryIndex = {
  folder: string;
  scannedAt: number;
  entries: LibraryEntry[];
};

/** Rebuilds the index for `folder` and stores it. */
export async function scanLibrary(folder: string) {
  return invoke<LibraryIndex>("scan_library", { folder });
}

/** Stops the running scan; the previous index is kept. */
export async function cancelLibraryScan() {
  await invoke("cancel_library_scan");
}

export type ScanProgress = { processed: number; total: number };

/** The last stored index, or null when the folder has never been scanned. */
export async function loadLibrary() {
  return invoke<LibraryIndex | null>("load_library");
}

/** One local audio file analysed for a catalogue match. */
export type LocalLoopAnalysis = {
  path: string;
  name: string;
  key: string | null;
  bpm: number | null;
  durationMs: number;
};

/** Detects the key and tempo of a file the user dropped into the loop matcher. */
export async function analyzeLocalLoop(path: string) {
  return invoke<LocalLoopAnalysis>("analyze_local_loop", { path });
}

/** Marks one indexed file as a favourite and returns the updated index. */
export async function setLibraryFavorite(path: string, favorite: boolean) {
  return invoke<LibraryIndex>("set_library_favorite", { path, favorite });
}

/** One audio file that sounds close to the requested sample. */
export type SimilarMatch = {
  path: string;
  name: string;
  pack: string;
  instrument: string;
  score: number;
};

/** Which half of the audio profile a similarity search should compare. */
export type SimilarMode = "harmonic" | "rhythmic" | "combined";

/** Ranks indexed files by similarity to `path`. */
export async function findSimilar(path: string, limit: number, mode: SimilarMode = "combined") {
  return invoke<SimilarMatch[]>("find_similar", { path, limit, mode });
}
