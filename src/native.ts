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
